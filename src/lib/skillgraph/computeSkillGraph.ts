import { dbConnect } from "@/lib/mongodb";
import { User } from "@/models/User";
import { fetcherOctokit } from "@/lib/github-app-client";
import { RateLimitedQueue } from "@/lib/fetcher/limiter";
import { collectUserActivity } from "@/lib/skillgraph/collectUserActivity";
import {
  analyzeSkillWithAI,
  heuristicSkillGraph,
  type SkillGraph,
} from "@/lib/skillgraph/analyzeSkill";

export const SKILL_GRAPH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Is a recompute warranted? Only on manual refresh or after 30 days. */
export function skillGraphStale(computedAt: Date | null | undefined) {
  if (!computedAt) return true;
  return Date.now() - new Date(computedAt).getTime() > SKILL_GRAPH_MAX_AGE_MS;
}

/**
 * Collect activity, analyse it, persist the result. Safe to call repeatedly:
 * a concurrent call while one is already computing returns early.
 */
export async function computeSkillGraph(
  userId: string,
  opts?: { force?: boolean },
): Promise<{ ok: boolean; reason?: string; graph?: SkillGraph }> {
  await dbConnect();
  const user = await User.findById(userId);
  if (!user) return { ok: false, reason: "user not found" };

  if (!opts?.force && user.skillGraph && !skillGraphStale(user.skillGraph.computedAt)) {
    return { ok: true, reason: "fresh", graph: user.skillGraph as unknown as SkillGraph };
  }
  if (user.skillGraphStatus === "computing") {
    return { ok: false, reason: "already computing" };
  }

  user.skillGraphStatus = "computing";
  user.skillGraphError = "";
  await user.save();

  try {
    const { octokit } = fetcherOctokit();
    const queue = new RateLimitedQueue();
    const activity = await collectUserActivity(user.username, octokit, queue);

    if (activity.totals.repos === 0 && activity.totals.mergedPrs === 0) {
      user.skillGraphStatus = "idle";
      user.skillGraphError = "No public activity found";
      await user.save();
      return { ok: false, reason: "no activity" };
    }

    const fromAI = activity.sparse ? null : await analyzeSkillWithAI(activity);
    const base = fromAI ?? heuristicSkillGraph(activity);

    const graph: SkillGraph = {
      ...base,
      source: fromAI ? "ai" : "heuristic",
      computedAt: new Date(),
      evidence: {
        repos: activity.totals.repos,
        commits: activity.totals.commits,
        mergedPrs: activity.totals.mergedPrs,
      },
    };

    user.set("skillGraph", graph);
    user.skillGraphStatus = "idle";
    await user.save();

    console.log(
      `[skillgraph] ${user.username}: ${graph.source} · tier=${graph.overallTier} · ` +
        `${graph.languageSkills.length} languages · evidence ${graph.evidence.repos}r/${graph.evidence.commits}c/${graph.evidence.mergedPrs}pr`,
    );
    return { ok: true, graph };
  } catch (err) {
    user.skillGraphStatus = "error";
    user.skillGraphError = err instanceof Error ? err.message : "failed";
    await user.save();
    console.error("[skillgraph] failed:", err);
    return { ok: false, reason: user.skillGraphError };
  }
}
