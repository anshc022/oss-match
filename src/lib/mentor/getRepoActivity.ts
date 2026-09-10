import type { Octokit } from "octokit";
import { RateLimitedQueue } from "@/lib/fetcher/limiter";

/**
 * Who is actually active on a repo right now. Pulls the last ~30 issue
 * comments, the last ~20 merged PRs, and reviews on the most recent of those,
 * then tallies per person. Roughly ten API calls per repo, cached weekly.
 */

const WINDOW_DAYS = 60;
const COMMENTS = 30;
const PRS = 20;
const REVIEWED_PRS = 8;

export type PersonActivity = {
  username: string;
  avatarUrl: string;
  comments: number;
  reviews: number;
  mergedPrs: number;
  lastActiveDaysAgo: number;
  /** A few short comment openings, so the ranker can see tone and topic. */
  samples: string[];
  isOwner: boolean;
};

export type RepoActivitySummary = {
  fullName: string;
  windowDays: number;
  people: PersonActivity[];
  collectedAt: string;
};

export async function getRepoActivity(
  fullName: string,
  octokit: Octokit,
  queue: RateLimitedQueue,
): Promise<RepoActivitySummary | null> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) return null;
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  const people = new Map<string, PersonActivity>();
  const touch = (login: string | undefined, avatar: string | undefined, when: string | null | undefined) => {
    if (!login || /\[bot\]$/i.test(login)) return null;
    const row =
      people.get(login) ??
      people
        .set(login, {
          username: login,
          avatarUrl: avatar ?? "",
          comments: 0,
          reviews: 0,
          mergedPrs: 0,
          lastActiveDaysAgo: Number.MAX_SAFE_INTEGER,
          samples: [],
          isOwner: login.toLowerCase() === owner.toLowerCase(),
        })
        .get(login)!;
    if (when) {
      const days = Math.floor((Date.now() - new Date(when).getTime()) / 86_400_000);
      row.lastActiveDaysAgo = Math.min(row.lastActiveDaysAgo, days);
    }
    return row;
  };

  const comments =
    (await queue.run(
      () =>
        octokit.rest.issues
          .listCommentsForRepo({ owner, repo, since, sort: "updated", direction: "desc", per_page: COMMENTS })
          .then((r) => r.data)
          .catch(() => []),
      "core",
    )) ?? [];
  for (const c of comments) {
    const row = touch(c.user?.login, c.user?.avatar_url, c.created_at);
    if (!row) continue;
    row.comments += 1;
    if (row.samples.length < 2 && c.body) row.samples.push(c.body.replace(/\s+/g, " ").slice(0, 140));
  }

  const pulls =
    (await queue.run(
      () =>
        octokit.rest.pulls
          .list({ owner, repo, state: "closed", sort: "updated", direction: "desc", per_page: PRS })
          .then((r) => r.data.filter((p) => p.merged_at && p.merged_at >= since))
          .catch(() => []),
      "core",
    )) ?? [];
  for (const p of pulls) {
    const row = touch(p.user?.login, p.user?.avatar_url, p.merged_at);
    if (row) row.mergedPrs += 1;
  }

  for (const p of pulls.slice(0, REVIEWED_PRS)) {
    if (queue.isExhausted("core")) break;
    const reviews =
      (await queue.run(
        () => octokit.rest.pulls.listReviews({ owner, repo, pull_number: p.number, per_page: 20 }).then((r) => r.data).catch(() => []),
        "core",
      )) ?? [];
    for (const r of reviews) {
      if (r.user?.login === p.user?.login) continue; // self-review is not mentoring
      const row = touch(r.user?.login, r.user?.avatar_url, r.submitted_at);
      if (row) row.reviews += 1;
    }
  }

  const list = Array.from(people.values())
    .filter((p) => p.comments + p.reviews + p.mergedPrs > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 12);

  return { fullName, windowDays: WINDOW_DAYS, people: list, collectedAt: new Date().toISOString() };
}

/** Reviews and comments are what a newcomer needs; a merged PR says less about responsiveness. */
export function score(p: PersonActivity) {
  const recency = p.lastActiveDaysAgo <= 7 ? 1.3 : p.lastActiveDaysAgo <= 30 ? 1 : 0.6;
  return (p.reviews * 3 + p.comments * 2 + p.mergedPrs * 1) * recency;
}
