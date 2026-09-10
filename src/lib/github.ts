import { Octokit } from "octokit";
import { dbConnect } from "@/lib/mongodb";
import { RepoMeta, type RepoMetaDoc } from "@/models/RepoMeta";
import { LABEL_QUERIES } from "@/lib/constants";
import { summarizeContributing } from "@/lib/contributing";
import { pooled } from "@/lib/pool";

export { summarizeContributing, pooled, LABEL_QUERIES };

/**
 * A server-side token lifts the search rate limit from 10 req/min
 * (unauthenticated) to 30 req/min, and the core limit to 5000/hr.
 *
 * Octokit's throttle and retry plugins sleep until the limit resets, which
 * turns a rate-limited feed request into a multi-minute hang. Every caller
 * here has a cache or a null-safe fallback, so failing fast and degrading
 * beats waiting.
 */
export function serverOctokit() {
  return new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
    userAgent: "oss-match",
    throttle: { onRateLimit: () => false, onSecondaryRateLimit: () => false },
    retry: { enabled: false },
    request: { timeout: REQUEST_TIMEOUT_MS },
  });
}

const REQUEST_TIMEOUT_MS = 8_000;

export function userOctokit(token: string) {
  return new Octokit({ auth: token, userAgent: "oss-match" });
}

export type CandidateIssue = {
  id: number;
  number: number;
  title: string;
  body: string;
  htmlUrl: string;
  repoFullName: string;
  repoUrl: string;
  labels: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
  hasLinkedPr: boolean;
  assigned: boolean;
  language: string;
};

export type RepoSignals = Omit<RepoMetaDoc, "_id">;

/** Past this, a cached repo is revalidated; the TTL index expires it at 3 days. */
const REPO_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Repo health signals the search API doesn't return: last push date, and
 * whether the repo ships CONTRIBUTING.md / CODE_OF_CONDUCT.md / CI.
 *
 * A cold lookup costs three API calls. Within REPO_FRESH_MS the cache answers
 * for free; past it, the repo call is replayed with If-None-Match, and an
 * unchanged repo comes back 304, skipping the two follow-up calls. Measured
 * against the live API, a 304 still decrements the rate limit, so this is a
 * 3-calls-to-1 saving rather than a free refresh.
 */
export type RateLimitObserver = (headers: Record<string, unknown> | undefined) => void;

export async function getRepoMeta(
  fullName: string,
  opts?: {
    /**
     * Called with the rate-limit headers of every response. The background
     * fetcher passes its queue here so core-budget spend is actually metered;
     * the request path passes nothing and behaves exactly as before.
     */
    observe?: RateLimitObserver;
  },
): Promise<RepoSignals | null> {
  await dbConnect();
  const cached = (await RepoMeta.findOne({ fullName }).lean()) as RepoSignals | null;

  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < REPO_FRESH_MS) {
    return cached;
  }

  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) return cached;

  const octokit = serverOctokit();
  try {
    const repoRes = await octokit.rest.repos.get({
      owner,
      repo,
      headers: cached?.etag ? { "if-none-match": cached.etag } : undefined,
    });
    opts?.observe?.(repoRes.headers as Record<string, unknown>);
    const r = repoRes.data;

    const [community, ci] = await Promise.all([
      octokit.rest.repos
        .getCommunityProfileMetrics({ owner, repo })
        .then((res) => {
          opts?.observe?.(res.headers as Record<string, unknown>);
          return res.data;
        })
        .catch((e) => {
          opts?.observe?.(e?.response?.headers);
          return null;
        }),
      octokit.rest.actions
        .listRepoWorkflows({ owner, repo, per_page: 1 })
        .then((res) => {
          opts?.observe?.(res.headers as Record<string, unknown>);
          return res.data.total_count > 0;
        })
        .catch((e) => {
          opts?.observe?.(e?.response?.headers);
          return false;
        }),
    ]);

    const contributing = community?.files?.contributing ?? null;

    const meta: RepoSignals = {
      fullName,
      etag: (repoRes.headers.etag as string) ?? "",
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      openIssues: r.open_issues_count ?? 0,
      pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
      language: r.language ?? "",
      topics: r.topics ?? [],
      defaultBranch: r.default_branch ?? "main",
      cloneUrl: r.clone_url ?? `https://github.com/${fullName}.git`,
      // A community profile call that failed must not erase a known-good
      // signal from the cached record.
      hasContributing: community
        ? Boolean(contributing)
        : cached?.hasContributing ?? false,
      contributingPath: contributing?.html_url ?? cached?.contributingPath ?? "",
      hasCodeOfConduct: community
        ? Boolean(community.files?.code_of_conduct)
        : cached?.hasCodeOfConduct ?? false,
      hasCi: ci || (cached?.hasCi ?? false),
      archived: Boolean(r.archived),
      fetchedAt: new Date(),
    };

    await RepoMeta.findOneAndUpdate(
      { fullName },
      { ...meta, expiresAt: new Date() },
      { upsert: true },
    );
    return meta;
  } catch (err) {
    const status = (err as { status?: number }).status;
    opts?.observe?.(
      (err as { response?: { headers?: Record<string, unknown> } }).response?.headers,
    );

    // 304: unchanged upstream. Reset the clock, keep the payload, spend nothing.
    if (status === 304 && cached) {
      await RepoMeta.updateOne(
        { fullName },
        { fetchedAt: new Date(), expiresAt: new Date() },
      );
      return { ...cached, fetchedAt: new Date() };
    }

    // Rate limited or transient: stale data beats no data.
    if (cached) return cached;

    console.error(`[github] repo meta failed for ${fullName}:`, err);
    return null;
  }
}

/**
 * Languages the user actually writes, tallied by repo count across their
 * non-fork public repos. Uses the public listing endpoint so the OAuth app
 * never has to ask for a repo scope.
 */
export async function inferUserLanguages(
  username: string,
  token?: string,
): Promise<string[]> {
  try {
    const octokit = token ? userOctokit(token) : serverOctokit();
    const res = await octokit.rest.repos.listForUser({
      username,
      per_page: 100,
      sort: "pushed",
      type: "owner",
    });
    const tally = new Map<string, number>();
    for (const repo of res.data) {
      if (repo.fork || !repo.language) continue;
      tally.set(repo.language, (tally.get(repo.language) ?? 0) + 1);
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([lang]) => lang);
  } catch (err) {
    console.error("[github] language inference failed:", err);
    return [];
  }
}

/** Raw CONTRIBUTING.md plus a short extractive summary. */
export async function fetchContributing(fullName: string) {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) return null;

  const octokit = serverOctokit();

  // The community profile knows the real path regardless of case or location
  // (next.js ships `contributing.md`, others use `.github/CONTRIBUTING.md`).
  // The guessed paths below are only a fallback.
  const meta = await getRepoMeta(fullName);
  const discovered = pathFromBlobUrl(meta?.contributingPath ?? "");

  const candidates = [
    discovered,
    "CONTRIBUTING.md",
    "contributing.md",
    ".github/CONTRIBUTING.md",
    ".github/contributing.md",
    "docs/CONTRIBUTING.md",
    "docs/contributing.md",
    "CONTRIBUTING.rst",
    "CONTRIBUTING",
  ].filter((p): p is string => Boolean(p));

  const tried = new Set<string>();
  for (const path of candidates) {
    if (tried.has(path)) continue;
    tried.add(path);
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path });
      const data = res.data;
      if (Array.isArray(data) || data.type !== "file" || !data.content) continue;
      const markdown = Buffer.from(data.content, "base64").toString("utf8");
      return {
        path,
        htmlUrl:
          data.html_url ??
          meta?.contributingPath ??
          `https://github.com/${fullName}/blob/HEAD/${path}`,
        markdown,
        summary: summarizeContributing(markdown),
      };
    } catch {
      // 404 for this path; try the next one.
    }
  }
  return null;
}

/**
 * `https://github.com/o/r/blob/canary/contributing.md` -> `contributing.md`.
 * Returns "" for anything that isn't a blob URL.
 */
export function pathFromBlobUrl(blobUrl: string) {
  const match = /\/blob\/[^/]+\/(.+)$/.exec(blobUrl);
  return match ? decodeURIComponent(match[1]) : "";
}

export function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}
