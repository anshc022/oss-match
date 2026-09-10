import type { Octokit } from "octokit";
import { dbConnect } from "@/lib/mongodb";
import { ApiCache } from "@/models/ApiCache";
import { Issue } from "@/models/Issue";
import { RepoMeta } from "@/models/RepoMeta";
import { computeMentors, HEURISTIC_MAX_AGE_MS, MENTORS_MAX_AGE_MS } from "@/lib/mentor/getMentors";
import { fetcherOctokit } from "@/lib/github-app-client";
import { getRepoMeta, isoDaysAgo, type CandidateIssue, type RepoSignals } from "@/lib/github";
import { scoreBase } from "@/lib/scoring";
import { hashResults } from "@/lib/fetcher/fingerprint";
import {
  RateLimitedQueue,
  isSecondaryRateLimit,
  retryAfterSeconds,
} from "@/lib/fetcher/limiter";
import {
  buildQueries,
  looksHacktoberfest,
  type FetchQuery,
} from "@/lib/fetcher/queries";

/** Issues pulled per query. GitHub caps search pages at 100. */
const PER_PAGE = 50;
/** Repos resolved per query. Metadata is cached, so this is a cold-start cost. */
const MAX_REPOS_PER_QUERY = 25;
/** Mentor refreshes per cycle; ~10 GitHub calls plus a bounded model call each. */
const MENTORS_PER_CYCLE = 2;

export type QueryResult = {
  key: string;
  /** 200 = fresh data, 304 = unchanged, 0 = skipped, -1 = failed. */
  status: number;
  itemsSeen: number;
  upserted: number;
  reposResolved: number;
  skippedReason?: string;
  error?: string;
};

export type FetchCycleReport = {
  startedAt: string;
  durationMs: number;
  authMode: string;
  hacktoberfest: boolean;
  queriesPlanned: number;
  queriesRun: number;
  /** 304 responses. Search does not emit ETags, so this is 0 for search queries. */
  etagHits: number;
  etagMisses: number;
  /** Fresh responses whose contents matched the previous cycle exactly. */
  unchangedHits: number;
  issuesUpserted: number;
  reposResolved: number;
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
  rateLimitResetsIn: number | null;
  budgetSkips: number;
  failures: number;
  /** Secondary (abuse) limits hit this cycle, which close a lane early. */
  secondaryLimits: Array<{ resource: string; retryAfterSeconds: number | null }>;
  coreRemaining: number | null;
  searchRemaining: number | null;
  mentorsRefreshed: number;
  results: QueryResult[];
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
 * Run one search query against GitHub, replaying the stored ETag.
 *
 * Returns `items: null` on a 304, which is the signal to skip scoring and
 * upserting entirely: the result set has not changed since last cycle.
 */
export async function fetchIssuesForQuery(
  query: FetchQuery,
  queue: RateLimitedQueue,
  octokit: Octokit,
): Promise<{
  items: CandidateIssue[] | null;
  status: number;
  /** True when the result set is byte-identical to the previous cycle's. */
  unchanged?: boolean;
  error?: string;
}> {
  await dbConnect();
  const cached = await ApiCache.findOne({ queryKey: query.key }).lean();

  const q = buildSearchQuery(query);

  const outcome = await queue.run(async () => {
    try {
      const res = await octokit.request("GET /search/issues", {
        q,
        advanced_search: "true",
        sort: "updated",
        order: "desc",
        per_page: PER_PAGE,
        headers: cached?.etag ? { "if-none-match": cached.etag } : undefined,
      });
      queue.observe(res.headers as Record<string, unknown>);
      return { res, err: null as unknown };
    } catch (err) {
      const headers = (err as { response?: { headers?: Record<string, unknown> } })
        .response?.headers;
      queue.observe(headers);
      return { res: null, err };
    }
  }, "search");

  // Budget floor reached; the queue declined to run this one.
  if (outcome === null) {
    return { items: null, status: 0, error: "rate-limit floor" };
  }

  if (outcome.err) {
    const status = (outcome.err as { status?: number }).status ?? -1;

    if (isSecondaryRateLimit(outcome.err)) {
      queue.penalise("search", retryAfterSeconds(outcome.err));
      return { items: null, status, error: "secondary rate limit" };
    }

    if (status === 304) {
      await ApiCache.updateOne(
        { queryKey: query.key },
        { $set: { lastFetchedAt: new Date(), lastStatus: 304 }, $inc: { hitCount: 1 } },
      );
      return { items: null, status: 304 };
    }

    return {
      items: null,
      status,
      error: outcome.err instanceof Error ? outcome.err.message : String(outcome.err),
    };
  }

  const res = outcome.res!;
  const items = (res.data.items as SearchItem[]).map((item) =>
    toCandidate(item, query.language),
  );

  const resultHash = hashResults(items);
  const unchanged = Boolean(cached?.resultHash) && cached!.resultHash === resultHash;

  await ApiCache.findOneAndUpdate(
    { queryKey: query.key },
    {
      $set: {
        queryKey: query.key,
        // Kept even though search never sends one today, so the conditional
        // request starts working the moment GitHub adds support.
        etag: (res.headers.etag as string) ?? cached?.etag ?? "",
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

function buildSearchQuery(query: FetchQuery) {
  return [
    `label:"${query.label}"`,
    query.language ? `language:${query.language}` : "",
    query.topic ? `topic:${query.topic}` : "",
    "state:open",
    "is:issue",
    "no:assignee",
    "archived:false",
    `created:>${isoDaysAgo(365)}`,
  ]
    .filter(Boolean)
    .join(" ");
}

function toCandidate(item: SearchItem, language: string): CandidateIssue {
  const repoFullName = item.repository_url.replace(
    "https://api.github.com/repos/",
    "",
  );
  return {
    id: item.id,
    number: item.number,
    title: item.title,
    body: (item.body ?? "").slice(0, 1200),
    htmlUrl: item.html_url,
    repoFullName,
    repoUrl: `https://github.com/${repoFullName}`,
    labels: item.labels
      .map((l) => (typeof l === "string" ? l : l.name ?? ""))
      .filter(Boolean),
    comments: item.comments ?? 0,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    hasLinkedPr: Boolean(item.draft),
    assigned: Boolean(item.assignee || (item.assignees && item.assignees.length > 0)),
    language,
  };
}

/**
 * Score a batch and write it to the serving collection.
 *
 * Repo metadata comes through the same queue, so resolving it is paced and
 * counted against the same budget as the searches.
 */
export async function scoreAndUpsert(
  items: CandidateIssue[],
  query: FetchQuery,
  queue: RateLimitedQueue,
  /** Wall-clock cut-off shared with the cycle, so a slowed queue cannot overrun it. */
  deadline = Infinity,
): Promise<{ upserted: number; reposResolved: number }> {
  await dbConnect();

  const repoNames = Array.from(new Set(items.map((i) => i.repoFullName))).slice(
    0,
    MAX_REPOS_PER_QUERY,
  );

  const repos = new Map<string, RepoSignals>();
  for (const name of repoNames) {
    // Pacing widens as budget drains, so the deadline is checked per repo and
    // not only between queries. Whatever resolved still gets written.
    if (queue.isExhausted("core") || Date.now() > deadline) break;
    const meta = await queue.run(
      () => getRepoMeta(name, { observe: (h) => queue.observe(h) }),
      "core",
    );
    if (meta) repos.set(name, meta);
  }

  const now = new Date();
  const writes = [];

  for (const item of items) {
    const repo = repos.get(item.repoFullName);
    // An issue we cannot assess is not written: ranking one without repo
    // signals is what floated zero-star repos to the top of the old feed.
    if (!repo || repo.archived) continue;

    const { baseScore, breakdown } = scoreBase(item, repo);

    writes.push({
      updateOne: {
        filter: { issueUrl: item.htmlUrl },
        update: {
          $set: {
            githubId: item.id,
            number: item.number,
            title: item.title,
            body: item.body,
            repoFullName: item.repoFullName,
            repoUrl: item.repoUrl,
            labels: item.labels,
            comments: item.comments,
            issueCreatedAt: new Date(item.createdAt),
            issueUpdatedAt: new Date(item.updatedAt),
            assigned: item.assigned,
            hasLinkedPr: item.hasLinkedPr,
            language: repo.language || item.language,
            topics: repo.topics ?? [],
            stars: repo.stars,
            forks: repo.forks,
            pushedAt: repo.pushedAt,
            defaultBranch: repo.defaultBranch,
            cloneUrl: repo.cloneUrl,
            hasContributing: repo.hasContributing,
            hasCodeOfConduct: repo.hasCodeOfConduct,
            hasCi: repo.hasCi,
            archived: repo.archived,
            baseScore,
            baseBreakdown: breakdown,
            isHacktoberfest:
              query.isHacktoberfest || looksHacktoberfest(item.labels),
            lastScoredAt: now,
            lastSeenAt: now,
          },
          $setOnInsert: { issueUrl: item.htmlUrl, firstSeenAt: now },
          $addToSet: { sourceQueries: query.key },
        },
        upsert: true,
      },
    });
  }

  if (writes.length === 0) return { upserted: 0, reposResolved: repos.size };

  const result = await Issue.bulkWrite(writes, { ordered: false });
  return {
    upserted: (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0),
    reposResolved: repos.size,
  };
}

/**
 * One full fetch cycle: walk the query matrix, skipping any query still inside
 * its refresh interval, and report what happened.
 */
export async function runFetchCycle(options?: {
  languages?: readonly string[];
  hacktoberfest?: boolean;
  /** Ignore per-query refresh intervals. Used by manual triggers. */
  force?: boolean;
  /** Stop starting new queries past this wall-clock budget. */
  deadlineMs?: number;
  /** Mentor refreshes to attempt this cycle. Defaults to a small number. */
  mentorsLimit?: number;
  /** Skip issue queries entirely; used to backfill mentors on demand. */
  skipIssues?: boolean;
}): Promise<FetchCycleReport> {
  const startedAt = new Date();
  const start = Date.now();
  const deadline = start + (options?.deadlineMs ?? 55_000);

  await dbConnect();

  const { octokit, mode } = fetcherOctokit();
  const queue = new RateLimitedQueue();
  const queries = buildQueries({
    languages: options?.languages,
    hacktoberfest: options?.hacktoberfest,
  });

  const results: QueryResult[] = [];
  let etagHits = 0;
  let etagMisses = 0;
  let unchangedHits = 0;
  let issuesUpserted = 0;
  let reposResolved = 0;
  let failures = 0;

  // Which queries are still inside their refresh window?
  const cacheRows = await ApiCache.find({
    queryKey: { $in: queries.map((q) => q.key) },
  })
    .select("queryKey lastFetchedAt")
    .lean();
  const lastFetched = new Map(
    cacheRows.map((r) => [r.queryKey, new Date(r.lastFetchedAt).getTime()]),
  );

  for (const query of options?.skipIssues ? [] : queries) {
    if (Date.now() > deadline) {
      results.push({
        key: query.key,
        status: 0,
        itemsSeen: 0,
        upserted: 0,
        reposResolved: 0,
        skippedReason: "cycle deadline",
      });
      continue;
    }

    if (queue.isExhausted("search")) {
      results.push({
        key: query.key,
        status: 0,
        itemsSeen: 0,
        upserted: 0,
        reposResolved: 0,
        skippedReason: "search rate-limit floor",
      });
      continue;
    }

    const last = lastFetched.get(query.key);
    if (!options?.force && last && Date.now() - last < query.minIntervalMs) {
      results.push({
        key: query.key,
        status: 0,
        itemsSeen: 0,
        upserted: 0,
        reposResolved: 0,
        skippedReason: "within refresh interval",
      });
      continue;
    }

    const { items, status, error, unchanged } = await fetchIssuesForQuery(
      query,
      queue,
      octokit,
    );

    if (status === 304) {
      etagHits += 1;
      results.push({ key: query.key, status, itemsSeen: 0, upserted: 0, reposResolved: 0 });
      continue;
    }

    // Same results as last cycle: the search call is already spent, but the
    // expensive half (three API calls per repo, plus scoring) is skipped.
    if (items && unchanged) {
      unchangedHits += 1;
      results.push({
        key: query.key,
        status,
        itemsSeen: items.length,
        upserted: 0,
        reposResolved: 0,
        skippedReason: "results unchanged",
      });
      continue;
    }

    if (!items) {
      if (status !== 0) failures += 1;
      results.push({
        key: query.key,
        status,
        itemsSeen: 0,
        upserted: 0,
        reposResolved: 0,
        error,
        skippedReason: status === 0 ? "rate-limit floor" : undefined,
      });
      continue;
    }

    etagMisses += 1;
    const { upserted, reposResolved: resolved } = await scoreAndUpsert(
      items,
      query,
      queue,
      deadline,
    );
    issuesUpserted += upserted;
    reposResolved += resolved;

    results.push({
      key: query.key,
      status,
      itemsSeen: items.length,
      upserted,
      reposResolved: resolved,
    });
  }

  // Mentor suggestions ride along on the same cycle: a few stale repos per run,
  // only with budget and time to spare, so issue freshness always comes first.
  let mentorsRefreshed = 0;
  if (!queue.isExhausted("core") && Date.now() < deadline - 8_000) {
    const cutoff = new Date(Date.now() - MENTORS_MAX_AGE_MS);
    const heuristicCutoff = new Date(Date.now() - HEURISTIC_MAX_AGE_MS);
    // Only repos that are actually being served: those are the ones a user
    // will see a contact for. Popular first, since they head the feed.
    const served = await Issue.distinct("repoFullName", { archived: false });
    const stale = await RepoMeta.find({
      fullName: { $in: served },
      $or: [
        { mentorsComputedAt: null },
        { mentorsComputedAt: { $lt: cutoff } },
        { mentorsSource: "heuristic", mentorsComputedAt: { $lt: heuristicCutoff } },
      ],
    })
      .sort({ stars: -1 })
      .limit(options?.mentorsLimit ?? MENTORS_PER_CYCLE)
      .select("fullName")
      .lean();
    for (const r of stale) {
      if (queue.isExhausted("core") || Date.now() > deadline - 4_000) break;
      await computeMentors(r.fullName, queue);
      mentorsRefreshed += 1;
    }
  }

  const rl = queue.rateLimit;

  return {
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - start,
    authMode: mode,
    hacktoberfest: queries.some((q) => q.isHacktoberfest),
    queriesPlanned: queries.length,
    queriesRun: etagHits + etagMisses + unchangedHits,
    etagHits,
    etagMisses,
    unchangedHits,
    issuesUpserted,
    reposResolved,
    rateLimitRemaining: rl?.remaining ?? null,
    rateLimitLimit: rl?.limit ?? null,
    rateLimitResetsIn: rl ? Math.max(0, rl.reset * 1000 - Date.now()) : null,
    budgetSkips: queue.skipped,
    failures,
    secondaryLimits: queue.penalties,
    coreRemaining: queue.rateLimitFor("core")?.remaining ?? null,
    searchRemaining: queue.rateLimitFor("search")?.remaining ?? null,
    mentorsRefreshed,
    results,
  };
}
