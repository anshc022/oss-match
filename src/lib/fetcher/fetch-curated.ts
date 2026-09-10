import type { Octokit } from "octokit";
import { dbConnect } from "@/lib/mongodb";
import { ApiCache } from "@/models/ApiCache";
import { fetcherOctokit, describeAuth } from "@/lib/github-app-client";
import type { CandidateIssue } from "@/lib/github";
import { hashResults } from "@/lib/fetcher/fingerprint";
import { RateLimitedQueue, isSecondaryRateLimit, retryAfterSeconds } from "@/lib/fetcher/limiter";
import { scoreAndUpsert } from "@/lib/fetcher/fetch-issues";
import { looksHacktoberfest, type FetchQuery } from "@/lib/fetcher/queries";
import { buildCuratedQuery, curatedKey, curatedSlice, CURATED_REPOS } from "@/lib/fetcher/curated";

/**
 * A second source of issues, alongside the language search matrix: walk a
 * curated list of repositories and take whatever newcomer-labelled issues each
 * one currently has open.
 *
 * One search call covers one repository, so a full pass over the list is far
 * more calls than fit in a single function invocation. Callers page through
 * with an offset instead, and the report says where to resume.
 */

/** Issues taken per repository. Few of these repos have more open than this. */
const PER_PAGE = 50;

export type CuratedRepoResult = {
  repo: string;
  status: number;
  itemsSeen: number;
  upserted: number;
  error?: string;
};

export type CuratedReport = {
  startedAt: string;
  durationMs: number;
  authMode: string;
  total: number;
  offset: number;
  nextOffset: number;
  /** True when this pass reached the end of the list and wrapped. */
  wrapped: boolean;
  reposPlanned: number;
  reposRun: number;
  issuesUpserted: number;
  unchangedHits: number;
  budgetSkips: number;
  failures: number;
  searchRemaining: number | null;
  coreRemaining: number | null;
  results: CuratedRepoResult[];
};

type SearchItem = {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  repository_url: string;
  labels: Array<{ name?: string } | string>;
  comments: number;
  created_at: string;
  updated_at: string;
  draft?: boolean;
  assignee?: unknown;
  assignees?: unknown[];
};

/**
 * `scoreAndUpsert` writes the query key onto every issue it touches and reads
 * the Hacktoberfest flag from it. Curated results carry a per-repo key so the
 * feed can tell where an issue came from; the label check still applies.
 */
function curatedQueryFor(repo: string): FetchQuery {
  return {
    key: curatedKey(repo),
    // Left empty on purpose: the repository's own language wins in the upsert,
    // and guessing here would mislabel polyglot repositories.
    language: "",
    label: "curated",
    isHacktoberfest: false,
    minIntervalMs: 0,
  };
}

function toCandidate(item: SearchItem): CandidateIssue {
  const repoFullName = item.repository_url.replace("https://api.github.com/repos/", "");
  return {
    id: item.id,
    number: item.number,
    title: item.title,
    body: (item.body ?? "").slice(0, 1200),
    htmlUrl: item.html_url,
    repoFullName,
    repoUrl: `https://github.com/${repoFullName}`,
    labels: item.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")).filter(Boolean),
    comments: item.comments ?? 0,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    hasLinkedPr: Boolean(item.draft),
    assigned: Boolean(item.assignee || (item.assignees && item.assignees.length > 0)),
    language: "",
  };
}

async function searchRepo(
  repo: string,
  queue: RateLimitedQueue,
  octokit: Octokit,
): Promise<{ items: CandidateIssue[] | null; status: number; unchanged?: boolean; error?: string }> {
  await dbConnect();
  const key = curatedKey(repo);
  const cached = await ApiCache.findOne({ queryKey: key }).lean();

  const outcome = await queue.run(async () => {
    try {
      const res = await octokit.request("GET /search/issues", {
        q: buildCuratedQuery(repo),
        advanced_search: "true",
        sort: "updated",
        order: "desc",
        per_page: PER_PAGE,
      });
      queue.observe(res.headers as Record<string, unknown>);
      return { res, err: null as unknown };
    } catch (err) {
      const headers = (err as { response?: { headers?: Record<string, unknown> } }).response?.headers;
      queue.observe(headers);
      return { res: null, err };
    }
  }, "search");

  if (outcome === null) return { items: null, status: 0, error: "rate-limit floor" };

  if (outcome.err) {
    const status = (outcome.err as { status?: number }).status ?? -1;
    if (isSecondaryRateLimit(outcome.err)) {
      queue.penalise("search", retryAfterSeconds(outcome.err));
      return { items: null, status, error: "secondary rate limit" };
    }
    // A renamed, deleted or newly private repository 404s. That is expected on
    // a vendored list and is not worth failing the pass over.
    return {
      items: null,
      status,
      error: outcome.err instanceof Error ? outcome.err.message : String(outcome.err),
    };
  }

  const items = (outcome.res!.data.items as SearchItem[]).map(toCandidate);
  const resultHash = hashResults(items);
  const unchanged = Boolean(cached?.resultHash) && cached!.resultHash === resultHash;

  await ApiCache.findOneAndUpdate(
    { queryKey: key },
    {
      $set: {
        queryKey: key,
        etag: (outcome.res!.headers.etag as string) ?? cached?.etag ?? "",
        resultHash,
        lastFetchedAt: new Date(),
        lastStatus: 200,
        lastItemCount: items.length,
      },
      $inc: unchanged ? { unchangedCount: 1 } : { missCount: 1 },
    },
    { upsert: true },
  );

  return { items, status: 200, unchanged };
}

/**
 * Walk `count` repositories starting at `offset`. Returns the offset to resume
 * from, so a caller can seed the whole list across repeated short calls.
 */
export async function runCuratedPass(options?: {
  offset?: number;
  count?: number;
  deadlineMs?: number;
  /** Re-search a repository even if its results were identical last time. */
  force?: boolean;
}): Promise<CuratedReport> {
  const started = Date.now();
  const deadline = started + (options?.deadlineMs ?? 40_000);
  const { repos, nextOffset, total, done } = curatedSlice(
    options?.offset ?? 0,
    options?.count ?? 15,
  );

  const auth = await describeAuth();
  const { octokit } = fetcherOctokit();
  const queue = new RateLimitedQueue();

  const results: CuratedRepoResult[] = [];
  let issuesUpserted = 0;
  let unchangedHits = 0;
  let budgetSkips = 0;
  let failures = 0;
  let reposRun = 0;

  for (const repo of repos) {
    if (Date.now() > deadline) break;
    if (queue.isExhausted("search")) {
      budgetSkips += 1;
      continue;
    }

    const found = await searchRepo(repo, queue, octokit);
    reposRun += 1;

    if (found.status === 0) {
      budgetSkips += 1;
      results.push({ repo, status: 0, itemsSeen: 0, upserted: 0, error: found.error });
      continue;
    }
    if (!found.items) {
      failures += 1;
      results.push({ repo, status: found.status, itemsSeen: 0, upserted: 0, error: found.error });
      continue;
    }
    if (found.unchanged) unchangedHits += 1;

    // Even an unchanged result is re-scored: repo signals such as stars and
    // push date move independently of the issue list, and the score depends
    // on them.
    const query = curatedQueryFor(repo);
    const hacktoberfest = found.items.some((i) => looksHacktoberfest(i.labels));
    const { upserted } = await scoreAndUpsert(
      found.items,
      { ...query, isHacktoberfest: hacktoberfest },
      queue,
      deadline,
    );
    issuesUpserted += upserted;
    results.push({ repo, status: found.status, itemsSeen: found.items.length, upserted });
  }

  return {
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    authMode: auth.mode,
    total,
    offset: (options?.offset ?? 0) % (CURATED_REPOS.length || 1),
    nextOffset,
    wrapped: done,
    reposPlanned: repos.length,
    reposRun,
    issuesUpserted,
    unchangedHits,
    budgetSkips: budgetSkips + queue.skipped,
    failures,
    searchRemaining: queue.rateLimitFor("search")?.remaining ?? null,
    coreRemaining: queue.rateLimitFor("core")?.remaining ?? null,
    results,
  };
}
