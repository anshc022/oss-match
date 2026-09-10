import { dbConnect } from "@/lib/mongodb";
import { RepoMeta } from "@/models/RepoMeta";
import { Issue } from "@/models/Issue";
import { fetcherOctokit } from "@/lib/github-app-client";
import { RateLimitedQueue } from "@/lib/fetcher/limiter";
import { collectRepoStructure, mentionedPaths } from "@/lib/deepdive/collectRepoStructure";
import {
  analyzeArchitectureWithAI,
  heuristicArchitecture,
  heuristicLocation,
  locateIssueWithAI,
} from "@/lib/deepdive/analyzeRepo";
import type { DeepDive, DeepDiveStage, IssueLocation, TreeNode } from "@/lib/deepdive/types";

export const DEEP_DIVE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function deepDiveStale(generatedAt: string | Date | null | undefined) {
  if (!generatedAt) return true;
  return Date.now() - new Date(generatedAt).getTime() > DEEP_DIVE_MAX_AGE_MS;
}

export type DeepDiveRead = {
  stage: DeepDiveStage;
  deepDive: DeepDive | null;
  location: IssueLocation | null;
  error: string;
};

/** Cached read: never touches GitHub or the model. */
export async function readDeepDive(repo: string, issueId?: string): Promise<DeepDiveRead> {
  await dbConnect();
  const [meta, issue] = await Promise.all([
    RepoMeta.findOne({ fullName: repo }).select("deepDive deepDiveStatus deepDiveError").lean(),
    issueId ? Issue.findById(issueId).select("deepDiveLocation").lean() : null,
  ]);
  const deepDive = (meta?.deepDive as DeepDive | null) ?? null;
  const status = (meta?.deepDiveStatus ?? "idle") as DeepDiveStage;
  const location = (issue?.deepDiveLocation as IssueLocation | null) ?? null;

  const fresh = deepDive && !deepDiveStale(deepDive.generatedAt);
  const stage: DeepDiveStage =
    status === "unavailable" ? "unavailable"
    : fresh && (!issueId || location) ? "ready"
    : status === "tree" || status === "analyzing" || status === "mapping" ? status
    : status === "error" && !fresh ? "error"
    : "idle";

  return { stage, deepDive: fresh ? deepDive : null, location, error: meta?.deepDiveError ?? "" };
}

/** One generation per repo at a time within this process. */
const inFlight = new Set<string>();

async function setStage(repo: string, stage: DeepDiveStage, error = "") {
  await RepoMeta.updateOne({ fullName: repo }, { $set: { deepDiveStatus: stage, deepDiveError: error } }, { upsert: true });
}

/**
 * Build (or refresh) the report. Never awaited by a page: the API starts it
 * and the client polls `readDeepDive` for the stage.
 */
export async function generateDeepDive(repo: string, issueId?: string): Promise<void> {
  const key = `${repo}::${issueId ?? ""}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    await dbConnect();
    const meta = await RepoMeta.findOne({ fullName: repo }).select("deepDive defaultBranch").lean();
    let deepDive = (meta?.deepDive as DeepDive | null) ?? null;
    const { octokit } = fetcherOctokit();
    const queue = new RateLimitedQueue();

    let allPaths: string[] = [];

    if (!deepDive || deepDiveStale(deepDive.generatedAt)) {
      await setStage(repo, "tree");
      const structure = await collectRepoStructure(repo, meta?.defaultBranch || "main", octokit, queue);
      if (!structure) throw new Error("could not read the repository");
      if (!structure.accessible) {
        await setStage(repo, "unavailable", "Repository is private, empty or no longer exists");
        return;
      }

      await setStage(repo, "analyzing");
      const ai = await analyzeArchitectureWithAI(structure);
      const base = ai ?? heuristicArchitecture(structure);

      deepDive = {
        ...base,
        stack: structure.stack,
        fileTree: structure.tree,
        truncated: structure.truncated,
        totalFiles: structure.totalFiles,
        source: ai ? "ai" : "heuristic",
        generatedAt: new Date().toISOString(),
      };
      await RepoMeta.updateOne({ fullName: repo }, { $set: { deepDive } }, { upsert: true });
      allPaths = flattenPaths(structure.tree);
      console.log(`[deepdive] ${repo}: ${deepDive.source} · ${deepDive.architecture.length} modules · ${structure.totalFiles} files${structure.truncated ? " (truncated)" : ""}`);
    } else {
      allPaths = flattenPaths(deepDive.fileTree);
    }

    if (issueId) {
      await setStage(repo, "mapping");
      const issue = await Issue.findById(issueId).select("title body deepDiveLocation").lean();
      if (issue) {
        const mentioned = mentionedPaths(`${issue.title}\n${issue.body ?? ""}`, allPaths);
        const ai = await locateIssueWithAI(deepDive.architecture, { title: issue.title, body: issue.body ?? "" }, mentioned);
        const location = ai ?? heuristicLocation(deepDive.architecture, mentioned);
        await Issue.updateOne({ _id: issueId }, { $set: { deepDiveLocation: location } });
        console.log(`[deepdive] ${repo} issue ${issueId}: ${location.source} → ${location.moduleIds.join(", ")}`);
      }
    }

    await setStage(repo, "ready");
  } catch (err) {
    console.error(`[deepdive] ${repo} failed:`, err);
    await setStage(repo, "error", err instanceof Error ? err.message : "failed");
  } finally {
    inFlight.delete(key);
  }
}

/** Every path in the pruned tree, for matching issue mentions. */
export function flattenPaths(tree: TreeNode): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode) => {
    if (n.path) out.push(n.path);
    n.children?.forEach(walk);
  };
  walk(tree);
  return out;
}

export function startDeepDiveInBackground(repo: string, issueId?: string) {
  void generateDeepDive(repo, issueId);
}
