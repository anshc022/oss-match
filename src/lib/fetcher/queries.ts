import {
  FEED_CACHE_TTL_MS,
  INTEREST_COPY,
  INTERESTS,
  LABEL_QUERIES,
  type Interest,
} from "@/lib/constants";

/**
 * The query matrix the background fetcher walks each cycle. One query is one
 * GitHub search call, one ApiCache row, and one ETag.
 */

/** Labels searched in every cycle. */
export const BASE_LABELS = LABEL_QUERIES;

/** Added on top of the base labels when Hacktoberfest mode is on. */
export const HACKTOBERFEST_LABELS = ["hacktoberfest"] as const;

/**
 * Languages the fetcher keeps warm. Deliberately narrower than the full
 * onboarding list: every language multiplies the cycle's call count, and these
 * cover the overwhelming majority of labelled newcomer issues.
 */
export const FETCH_LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C++",
  "Ruby",
  "PHP",
  "C#",
] as const;

export type FetchQuery = {
  /** Stable identity for the ApiCache row. */
  key: string;
  language: string;
  label: string;
  /** Optional topic qualifier, used for interest-targeted queries. */
  topic?: string;
  isHacktoberfest: boolean;
  /** Hacktoberfest queries refresh faster than the rest. */
  minIntervalMs: number;
};

export const NORMAL_INTERVAL_MS = FEED_CACHE_TTL_MS;
export const BOOST_INTERVAL_MS = 60 * 60 * 1000;
export const HACKTOBERFEST_INTERVAL_MS = 30 * 60 * 1000;

export function hacktoberfestMode() {
  return process.env.HACKTOBERFEST_MODE === "true";
}

export function boostMode() {
  return process.env.FETCH_BOOST_MODE === "true" || hacktoberfestMode();
}

/** Interval a non-Hacktoberfest query is allowed to be refreshed at. */
export function baseIntervalMs() {
  return boostMode() ? BOOST_INTERVAL_MS : NORMAL_INTERVAL_MS;
}

export function queryKey(language: string, label: string, topic?: string) {
  const parts = ["gh", language.toLowerCase(), label.toLowerCase()];
  if (topic) parts.push(`topic:${topic.toLowerCase()}`);
  return parts.join(":");
}

/**
 * The full query list for a cycle. Hacktoberfest queries are listed first so
 * that a cycle cut short by the rate-limit floor or a function timeout still
 * refreshes the time-sensitive ones.
 */
export function buildQueries(options?: {
  languages?: readonly string[];
  hacktoberfest?: boolean;
}): FetchQuery[] {
  const languages = options?.languages ?? FETCH_LANGUAGES;
  const hacktoberfest = options?.hacktoberfest ?? hacktoberfestMode();
  const normalInterval = baseIntervalMs();

  const queries: FetchQuery[] = [];

  if (hacktoberfest) {
    for (const language of languages) {
      for (const label of HACKTOBERFEST_LABELS) {
        queries.push({
          key: queryKey(language, label),
          language,
          label,
          isHacktoberfest: true,
          minIntervalMs: HACKTOBERFEST_INTERVAL_MS,
        });
      }
    }
  }

  for (const language of languages) {
    for (const label of BASE_LABELS) {
      queries.push({
        key: queryKey(language, label),
        language,
        label,
        isHacktoberfest: false,
        minIntervalMs: normalInterval,
      });
    }
  }

  return queries;
}

/** Topics that map an issue's repo onto one of the onboarding interests. */
export function interestsForTopics(topics: string[]): Interest[] {
  const set = new Set(topics.map((t) => t.toLowerCase()));
  return INTERESTS.filter((interest) =>
    INTEREST_COPY[interest].topics.some((t) => set.has(t)),
  );
}

/** Does this issue carry a Hacktoberfest label? */
export function looksHacktoberfest(labels: string[]) {
  return labels.some((l) => /hacktoberfest/i.test(l));
}
