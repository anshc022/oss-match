import type { Octokit } from "octokit";
import { RateLimitedQueue } from "@/lib/fetcher/limiter";

/**
 * A compact picture of what a user has actually shipped on GitHub, sized to
 * stay under ~40 API calls: their non-fork repos, recent commits in each, and
 * their merged pull requests with size signals. Runs once per user (or on a
 * manual refresh), never per session.
 */

const MAX_REPOS = 20;
const MAX_PRS = 15;
const COMMITS_PER_REPO = 30;

export type RepoActivity = {
  fullName: string;
  language: string;
  topics: string[];
  stars: number;
  commits: number;
  /** Days since the user's most recent commit here. */
  lastCommitDaysAgo: number | null;
  isOwner: boolean;
};

export type PrActivity = {
  repo: string;
  language: string;
  title: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergedAt: string;
};

export type ActivitySummary = {
  username: string;
  collectedAt: string;
  repos: RepoActivity[];
  mergedPrs: PrActivity[];
  /** Language -> aggregate counts, derived from the above. */
  languages: Record<string, { repos: number; commits: number; prs: number; linesChanged: number }>;
  totals: { repos: number; commits: number; mergedPrs: number };
  /** True when there was too little to say anything meaningful. */
  sparse: boolean;
};

export async function collectUserActivity(
  username: string,
  octokit: Octokit,
  queue: RateLimitedQueue,
  deadlineMs = 40_000,
): Promise<ActivitySummary> {
  const deadline = Date.now() + deadlineMs;
  const expired = () => Date.now() > deadline;

  // 1. Repos they own (forks excluded: a fork says nothing about what they wrote).
  const repoList =
    (await queue.run(
      () =>
        octokit.rest.repos
          .listForUser({ username, per_page: 60, sort: "pushed", type: "owner" })
          .then((r) => r.data.filter((repo) => !repo.fork).slice(0, MAX_REPOS)),
      "core",
    )) ?? [];

  const repos: RepoActivity[] = [];
  for (const repo of repoList) {
    if (expired() || queue.isExhausted("core")) break;
    const [owner, name] = repo.full_name.split("/");
    const commits =
      (await queue.run(
        () =>
          octokit.rest.repos
            .listCommits({ owner, repo: name, author: username, per_page: COMMITS_PER_REPO })
            .then((r) => r.data)
            .catch(() => []),
        "core",
      )) ?? [];

    const newest = commits[0]?.commit?.author?.date ?? commits[0]?.commit?.committer?.date ?? null;
    repos.push({
      fullName: repo.full_name,
      language: repo.language ?? "",
      topics: repo.topics ?? [],
      stars: repo.stargazers_count ?? 0,
      commits: commits.length,
      lastCommitDaysAgo: newest ? Math.floor((Date.now() - new Date(newest).getTime()) / 86_400_000) : null,
      isOwner: true,
    });
  }

  // 2. Merged PRs anywhere, including repos they don't own. This is the best
  //    signal of working in someone else's codebase.
  const prItems =
    (await queue.run(
      () =>
        octokit
          .request("GET /search/issues", {
            q: `author:${username} is:pr is:merged`,
            advanced_search: "true",
            sort: "updated",
            order: "desc",
            per_page: MAX_PRS,
          })
          .then((r) => r.data.items)
          .catch(() => []),
      "search",
    )) ?? [];

  const mergedPrs: PrActivity[] = [];
  for (const item of prItems) {
    if (expired() || queue.isExhausted("core")) break;
    const repoFull = String(item.repository_url).replace("https://api.github.com/repos/", "");
    const [owner, name] = repoFull.split("/");
    const pr = await queue.run(
      () => octokit.rest.pulls.get({ owner, repo: name, pull_number: item.number }).then((r) => r.data).catch(() => null),
      "core",
    );
    if (!pr) continue;
    mergedPrs.push({
      repo: repoFull,
      language: (pr.base?.repo?.language as string | null) ?? "",
      title: item.title,
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
      changedFiles: pr.changed_files ?? 0,
      mergedAt: pr.merged_at ?? item.closed_at ?? "",
    });
  }

  // 3. Roll up per language.
  const languages: ActivitySummary["languages"] = {};
  const bump = (lang: string, f: Partial<ActivitySummary["languages"][string]>) => {
    if (!lang) return;
    const row = (languages[lang] ??= { repos: 0, commits: 0, prs: 0, linesChanged: 0 });
    row.repos += f.repos ?? 0;
    row.commits += f.commits ?? 0;
    row.prs += f.prs ?? 0;
    row.linesChanged += f.linesChanged ?? 0;
  };
  for (const r of repos) bump(r.language, { repos: 1, commits: r.commits });
  for (const p of mergedPrs) bump(p.language, { prs: 1, linesChanged: p.additions + p.deletions });

  const totals = {
    repos: repos.length,
    commits: repos.reduce((n, r) => n + r.commits, 0),
    mergedPrs: mergedPrs.length,
  };

  return {
    username,
    collectedAt: new Date().toISOString(),
    repos,
    mergedPrs,
    languages,
    totals,
    sparse: totals.commits < 5 && totals.mergedPrs === 0,
  };
}
