import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { SavedIssue } from "@/models/SavedIssue";
import { SkippedIssue } from "@/models/SkippedIssue";
import { Issue, type IssueDoc } from "@/models/Issue";
import { RepoMeta } from "@/models/RepoMeta";
import { docToCandidate, docToRepoSignals } from "@/lib/issue-mapper";
import { rankIssues, type ScoreProfile, type ScoredIssue } from "@/lib/scoring";
import { INTEREST_COPY, type Interest } from "@/lib/constants";
import { scoreProfileFor } from "@/lib/score-profile";

export const dynamic = "force-dynamic";

/**
 * Reads the pre-fetched, pre-scored `issues` collection and nothing else. No
 * GitHub call happens on this path, so feed latency and GitHub rate limit are
 * fully decoupled from user traffic. The background fetcher
 * (src/lib/fetcher) is the only thing that talks to GitHub.
 *
 * Ranking is two-stage. Mongo narrows and orders by `baseScore`, the
 * user-independent part of the score computed at fetch time; the window that
 * comes back is then re-ranked with the full per-user algorithm. The
 * over-fetch below is what keeps the two stages from disagreeing at the page
 * boundary.
 */

/**
 * Mongoose 9 no longer exports FilterQuery, and spelling out exactly the
 * fields this route filters on is clearer than a broad Record anyway.
 */
type IssueFilter = {
  archived: boolean;
  assigned: boolean;
  language?: { $in: RegExp[] };
  isHacktoberfest?: boolean;
  topics?: { $in: string[] };
  issueUrl?: { $nin: string[] };
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
/** Pull this multiple of the page size so per-user re-ranking has room. */
const RERANK_OVERFETCH = 4;
const MAX_CANDIDATE_WINDOW = 400;

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Not onboarded" }, { status: 428 });
  }

  await dbConnect();

  const params = new URL(req.url).searchParams;
  const limit = clampInt(params.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const page = clampInt(params.get("page"), 1, 1, 500);
  const hacktoberfestOnly = params.get("hacktoberfest") === "true";

  const profileLanguages = user.languages?.length
    ? user.languages
    : user.suggestedLanguages ?? [];

  // Explicit filters override the stored profile.
  const languageFilter = splitCsv(params.get("language")) ?? profileLanguages;
  const interestFilter =
    (splitCsv(params.get("interest"))?.filter((i) =>
      Object.prototype.hasOwnProperty.call(INTEREST_COPY, i),
    ) as Interest[] | undefined) ?? [];

  const query: IssueFilter = { archived: false, assigned: false };

  if (languageFilter.length > 0) {
    query.language = { $in: languageFilter.map((l) => new RegExp(`^${escapeRegex(l)}$`, "i")) };
  }
  if (hacktoberfestOnly) {
    query.isHacktoberfest = true;
  }
  if (interestFilter.length > 0) {
    const topics = Array.from(
      new Set(interestFilter.flatMap((i) => INTEREST_COPY[i].topics)),
    );
    query.topics = { $in: topics };
  }

  // Exclude what this user has already acted on.
  const [saved, skipped] = await Promise.all([
    SavedIssue.find({ userId: user._id }).select("issueUrl").lean(),
    SkippedIssue.find({ userId: user._id }).select("issueUrl").lean(),
  ]);
  const seen = [
    ...saved.map((s) => s.issueUrl),
    ...skipped.map((s) => s.issueUrl),
  ];
  if (seen.length > 0) query.issueUrl = { $nin: seen };

  const offset = (page - 1) * limit;
  const window = Math.min(
    MAX_CANDIDATE_WINDOW,
    (offset + limit) * RERANK_OVERFETCH,
  );

  const [docs, totalAvailable] = await Promise.all([
    Issue.find(query).sort({ baseScore: -1, lastScoredAt: -1 }).limit(window).lean(),
    Issue.countDocuments(query),
  ]);

  const ranked = rankForUser(docs as unknown as IssueDoc[], scoreProfileFor(user));

  const pageItems = ranked.slice(offset, offset + limit);
  // Let the client link each card to its detail page.
  const idByUrl = new Map(
    (docs as unknown as IssueDoc[]).map((d) => [d.issueUrl, String(d._id)]),
  );

  // Attach the top suggested contact per repo. Still Mongo-only: one query
  // over the page's repos, reading what the background job cached.
  const pageRepos = Array.from(new Set(pageItems.map((i) => i.repoFullName)));
  const metas = await RepoMeta.find({ fullName: { $in: pageRepos }, "mentors.0": { $exists: true } })
    .select("fullName mentors")
    .lean();
  const mentorByRepo = new Map(metas.map((m) => [m.fullName, m.mentors?.[0] ?? null]));
  const staleness = oldestScoredAt(docs as unknown as IssueDoc[]);

  return NextResponse.json({
    issues: pageItems.map((i) => ({
      ...i,
      cacheId: idByUrl.get(i.htmlUrl),
      mentor: mentorByRepo.get(i.repoFullName) ?? null,
    })),
    page: {
      page,
      limit,
      returned: pageItems.length,
      totalAvailable,
      hasMore: offset + pageItems.length < Math.min(totalAvailable, ranked.length),
    },
    meta: {
      source: "cache",
      candidateWindow: docs.length,
      languages: languageFilter,
      interests: interestFilter,
      hacktoberfestOnly,
      // Null when the collection is empty, i.e. the fetcher has not run yet.
      oldestScoredAt: staleness,
    },
  });
}

function rankForUser(docs: IssueDoc[], profile: ScoreProfile): ScoredIssue[] {
  const repos = new Map(
    docs.map((doc) => [doc.repoFullName, docToRepoSignals(doc)]),
  );
  return rankIssues(docs.map(docToCandidate), repos, profile);
}

function oldestScoredAt(docs: IssueDoc[]): string | null {
  if (docs.length === 0) return null;
  const oldest = docs.reduce(
    (min, d) => Math.min(min, new Date(d.lastScoredAt).getTime()),
    Infinity,
  );
  return Number.isFinite(oldest) ? new Date(oldest).toISOString() : null;
}

function clampInt(raw: string | null, fallback: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function splitCsv(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
