import curated from "../../../data/curated-repos.json";

/**
 * A hand-curated list of repositories that reliably label newcomer issues,
 * vendored from the Good First Issue project (MIT, DeepSource). Only the
 * repository names are reused; every issue is fetched live from GitHub, so
 * nothing here goes stale beyond the list itself.
 *
 * The language-based search matrix in `queries.ts` finds issues by label and
 * language, which biases towards large repositories in popular languages.
 * Walking a known-good list instead reaches the long tail those searches miss.
 *
 * This file stays free of Octokit imports so the pure helpers can be tested
 * directly with tsx.
 */

export const CURATED_SOURCE = curated.source;
export const CURATED_REPOS: readonly string[] = curated.repositories;

/** Labels that mark an issue as newcomer-friendly on these repositories. */
export const CURATED_LABELS = [
  "good first issue",
  "good-first-issue",
  "help wanted",
  "beginner",
  "beginner-friendly",
  "first-timers-only",
  "easy",
  "low-hanging-fruit",
] as const;

/**
 * One search per repository. A comma-separated `label:` list is an OR in
 * GitHub's search syntax, so all the newcomer labels are covered by a single
 * call rather than one call per label.
 */
export function buildCuratedQuery(repoFullName: string) {
  const labels = CURATED_LABELS.map((l) => `"${l}"`).join(",");
  return [
    `repo:${repoFullName}`,
    `label:${labels}`,
    "state:open",
    "is:issue",
    "no:assignee",
    "archived:false",
  ].join(" ");
}

/** Stable ApiCache identity for a repository's curated search. */
export function curatedKey(repoFullName: string) {
  return `curated:${repoFullName.toLowerCase()}`;
}

/**
 * The slice of the list to walk on this call. Callers page through with an
 * offset so a full seed can be spread over many short invocations, which is
 * what a 60-second function limit requires for 800-odd repositories.
 */
export function curatedSlice(offset: number, count: number, list = CURATED_REPOS) {
  const total = list.length;
  if (total === 0 || count <= 0) return { repos: [], nextOffset: 0, total, done: true };
  const start = Math.max(0, Math.floor(offset)) % total;
  const repos = list.slice(start, start + count);
  const nextOffset = start + repos.length;
  return { repos, nextOffset: nextOffset >= total ? 0 : nextOffset, total, done: nextOffset >= total };
}
