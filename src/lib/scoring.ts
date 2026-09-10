import type { CandidateIssue, RepoSignals } from "@/lib/github";
import type { Interest, SkillLevel } from "@/lib/constants";
import { INTEREST_COPY } from "@/lib/constants";

/**
 * Every factor is normalised to 0-1, then combined with the weights below.
 * Weights sum to 1, so the final score is directly readable as a percentage.
 */
export const WEIGHTS = {
  language: 0.26,
  repoHealth: 0.18,
  freshness: 0.13,
  contention: 0.15,
  difficulty: 0.18,
  welcoming: 0.1,
} as const;

export type ScoreBreakdown = {
  language: number;
  repoHealth: number;
  freshness: number;
  contention: number;
  difficulty: number;
  welcoming: number;
};

export type ScoredIssue = CandidateIssue & {
  matchScore: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  repo: {
    fullName: string;
    stars: number;
    forks: number;
    language: string;
    pushedAt: string | null;
    hasContributing: boolean;
    hasCodeOfConduct: boolean;
    hasCi: boolean;
    defaultBranch: string;
    cloneUrl: string;
    contributingUrl: string;
  };
};

export type LanguageSkill = {
  language: string;
  level: SkillLevel;
  /** 0-1: how much evidence backed this call. */
  confidence: number;
};

export type ScoreProfile = {
  languages: string[];
  interests: Interest[];
  skillLevel: SkillLevel;
  /**
   * Computed from real GitHub activity (see src/lib/skillgraph). When present
   * it outranks the self-reported `languages` list for the language factor.
   */
  languageSkills?: LanguageSkill[];
};

/** Proficiency at a language, as a language-fit score. */
const LEVEL_FIT: Record<SkillLevel, number> = {
  beginner: 0.74,
  intermediate: 0.9,
  advanced: 1,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Log scale: 50 stars is a real project, 50k is not 1000x better. */
function starScore(stars: number) {
  if (stars <= 0) return 0;
  return clamp01(Math.log10(stars + 1) / Math.log10(20_000));
}

function daysSince(date: string | Date | null) {
  if (!date) return Infinity;
  return (Date.now() - new Date(date).getTime()) / 86_400_000;
}

/**
 * Language match. Exact match to a known language scores full marks; a repo
 * whose primary language the user doesn't list scores near zero, because
 * "I can't read this codebase" outranks every other virtue.
 */
export function scoreLanguage(issue: CandidateIssue, repo: RepoSignals | null, profile: ScoreProfile) {
  const known = profile.languages.map((l) => l.toLowerCase());
  if (known.length === 0 && !profile.languageSkills?.length) return 0.5;

  const repoLang = (repo?.language ?? issue.language ?? "").toLowerCase();
  if (!repoLang) return 0.35;

  // Evidence beats self-report. Blend by confidence so a thin signal still
  // leans on what the user told us rather than overriding it outright.
  const computed = profile.languageSkills?.find((s) => s.language.toLowerCase() === repoLang);
  if (computed) {
    const selfReport = known.includes(repoLang) ? clamp01(1 - known.indexOf(repoLang) * 0.05) : 0.3;
    const c = clamp01(computed.confidence);
    return clamp01(LEVEL_FIT[computed.level] * c + selfReport * (1 - c));
  }

  if (known.includes(repoLang)) {
    // Rank within the user's own list: their top language beats their eighth.
    const rank = known.indexOf(repoLang);
    return clamp01(1 - rank * 0.05);
  }
  if (ADJACENT[repoLang]?.some((l) => known.includes(l))) return 0.45;
  return 0.05;
}

/** Languages close enough that knowing one makes the other readable. */
const ADJACENT: Record<string, string[]> = {
  typescript: ["javascript"],
  javascript: ["typescript"],
  "c++": ["c", "rust"],
  c: ["c++", "rust"],
  kotlin: ["java"],
  java: ["kotlin", "scala"],
  scala: ["java"],
  swift: ["kotlin"],
  css: ["html", "javascript"],
  html: ["css", "javascript"],
};

/**
 * Repo health: stars and forks for reach, a push in the last 30 days for
 * liveness, CI for whether a PR gets verified. An archived or long-dead repo
 * is zeroed out — a merged PR there is worth nothing.
 */
export function scoreRepoHealth(repo: RepoSignals | null) {
  if (!repo || repo.archived) return 0;

  const stars = starScore(repo.stars);
  const forks = clamp01(Math.log10(repo.forks + 1) / Math.log10(3_000));

  const idle = daysSince(repo.pushedAt);
  let activity: number;
  if (idle <= 30) activity = 1;
  else if (idle <= 90) activity = 0.6;
  else if (idle <= 180) activity = 0.3;
  else if (idle <= 365) activity = 0.1;
  else activity = 0;

  const ci = repo.hasCi ? 1 : 0.4;

  // Activity dominates: a dead 40k-star repo is a worse bet than a live 200-star one.
  const base = stars * 0.28 + forks * 0.12 + activity * 0.45 + ci * 0.15;

  // A repo nobody uses is unproven no matter how recently it was pushed, and a
  // merged PR there does little for the contributor. Full credit past roughly
  // 50 stars-equivalent, scaled down below that.
  const traction = Math.min(1, (repo.stars + repo.forks * 2) / 50);

  return clamp01(base * (0.3 + 0.7 * traction));
}

/**
 * Freshness. Issues open under a week are ideal. The curve decays and then
 * floors out: a two-year-old "good first issue" is stale, not a hidden gem.
 */
export function scoreFreshness(issue: CandidateIssue) {
  const age = daysSince(issue.createdAt);
  const sinceTouched = daysSince(issue.updatedAt);

  let base: number;
  if (age <= 7) base = 1;
  else if (age <= 30) base = 0.85;
  else if (age <= 90) base = 0.6;
  else if (age <= 180) base = 0.35;
  else if (age <= 365) base = 0.15;
  else base = 0.05;

  // Recent maintainer activity on an older issue partially redeems it.
  const revived = sinceTouched <= 14 ? 0.15 : 0;
  return clamp01(base + revived);
}

/**
 * Contention: how likely is it someone already claimed this? Comment volume is
 * the proxy the search API gives us. Zero comments is a clean run; a
 * twenty-comment thread on a "good first issue" is a queue.
 */
export function scoreContention(issue: CandidateIssue) {
  if (issue.assigned) return 0;
  if (issue.hasLinkedPr) return 0.05;

  const c = issue.comments;
  if (c === 0) return 1;
  if (c <= 2) return 0.8;
  if (c <= 5) return 0.55;
  if (c <= 10) return 0.3;
  if (c <= 20) return 0.12;
  return 0.05;
}

const BEGINNER_LABELS = /(good.?first.?issue|first.?timers?.?only|beginner|easy|starter|low.?hanging|e-easy|difficulty:\s*easy)/i;
const INTERMEDIATE_LABELS = /(help.?wanted|intermediate|medium|difficulty:\s*medium|enhancement|feature)/i;
const ADVANCED_LABELS = /(hard|complex|difficulty:\s*hard|architecture|performance|refactor|epic|advanced)/i;

/**
 * Difficulty match. Deliberately not a filter: an advanced user still sees
 * "good first issue" results, just ranked below the meatier work, and a
 * beginner sees "help wanted" rather than only the tiny pool of curated
 * first issues.
 */
export function scoreDifficulty(issue: CandidateIssue, skill: SkillLevel) {
  const labels = issue.labels.join(" ");
  const beginner = BEGINNER_LABELS.test(labels);
  const intermediate = INTERMEDIATE_LABELS.test(labels);
  const advanced = ADVANCED_LABELS.test(labels);

  const matrix: Record<SkillLevel, { beginner: number; intermediate: number; advanced: number; none: number }> = {
    beginner:     { beginner: 1.0, intermediate: 0.55, advanced: 0.1, none: 0.4 },
    intermediate: { beginner: 0.6, intermediate: 1.0,  advanced: 0.65, none: 0.6 },
    advanced:     { beginner: 0.3, intermediate: 0.8,  advanced: 1.0,  none: 0.65 },
  };

  const row = matrix[skill];
  if (advanced) return row.advanced;
  if (intermediate && beginner) return Math.max(row.beginner, row.intermediate);
  if (intermediate) return row.intermediate;
  if (beginner) return row.beginner;
  return row.none;
}

/**
 * Welcoming signals: CONTRIBUTING.md and CODE_OF_CONDUCT.md. Both present is
 * the strongest available proxy for "this project expects newcomers".
 */
export function scoreWelcoming(repo: RepoSignals | null, issue: CandidateIssue) {
  if (!repo) return 0;
  let score = 0;
  if (repo.hasContributing) score += 0.6;
  if (repo.hasCodeOfConduct) score += 0.3;
  // An issue body with real detail means less guesswork for a first-timer.
  if (issue.body && issue.body.length > 280) score += 0.1;
  return clamp01(score);
}

/** Interest overlap adjusts the final score rather than being a weighted term. */
function interestMultiplier(repo: RepoSignals | null, interests: Interest[]) {
  if (!repo || interests.length === 0) return 1;
  const topics = new Set((repo.topics ?? []).map((t) => t.toLowerCase()));
  if (topics.size === 0) return 1;
  const hit = interests.some((i) =>
    INTEREST_COPY[i].topics.some((t) => topics.has(t)),
  );
  return hit ? 1.08 : 0.94;
}

export function scoreIssue(
  issue: CandidateIssue,
  repo: RepoSignals | null,
  profile: ScoreProfile,
): ScoredIssue {
  const breakdown: ScoreBreakdown = {
    language: scoreLanguage(issue, repo, profile),
    repoHealth: scoreRepoHealth(repo),
    freshness: scoreFreshness(issue),
    contention: scoreContention(issue),
    difficulty: scoreDifficulty(issue, profile.skillLevel),
    welcoming: scoreWelcoming(repo, issue),
  };

  const weighted =
    breakdown.language * WEIGHTS.language +
    breakdown.repoHealth * WEIGHTS.repoHealth +
    breakdown.freshness * WEIGHTS.freshness +
    breakdown.contention * WEIGHTS.contention +
    breakdown.difficulty * WEIGHTS.difficulty +
    breakdown.welcoming * WEIGHTS.welcoming;

  const matchScore = clamp01(weighted * interestMultiplier(repo, profile.interests));

  return {
    ...issue,
    language: repo?.language ?? issue.language,
    matchScore: Math.round(matchScore * 100) / 100,
    breakdown,
    reasons: explain(breakdown, issue, repo),
    repo: {
      fullName: issue.repoFullName,
      stars: repo?.stars ?? 0,
      forks: repo?.forks ?? 0,
      language: repo?.language ?? "",
      pushedAt: repo?.pushedAt ? new Date(repo.pushedAt).toISOString() : null,
      hasContributing: repo?.hasContributing ?? false,
      hasCodeOfConduct: repo?.hasCodeOfConduct ?? false,
      hasCi: repo?.hasCi ?? false,
      defaultBranch: repo?.defaultBranch ?? "main",
      cloneUrl: repo?.cloneUrl ?? `${issue.repoUrl}.git`,
      contributingUrl: repo?.contributingPath ?? "",
    },
  };
}

/** The two or three strongest factors, phrased for the card UI. */
function explain(
  b: ScoreBreakdown,
  issue: CandidateIssue,
  repo: RepoSignals | null,
): string[] {
  const out: string[] = [];
  if (b.language >= 0.9) out.push(`Written in ${repo?.language ?? "your language"}`);
  if (b.contention >= 0.8) out.push(issue.comments === 0 ? "No comments yet, nobody has claimed it" : "Barely any discussion, likely unclaimed");
  if (b.repoHealth >= 0.65) out.push("Actively maintained");
  if (repo?.hasContributing && repo?.hasCodeOfConduct) out.push("Has a contributing guide and code of conduct");
  else if (repo?.hasContributing) out.push("Has a contributing guide");
  if (b.freshness >= 0.85) out.push("Opened recently");
  if (b.difficulty >= 0.95) out.push("Difficulty matches your level");
  if (repo?.hasCi) out.push("CI runs on every PR");
  return out.slice(0, 4);
}

export function rankIssues(
  issues: CandidateIssue[],
  repos: Map<string, RepoSignals | null>,
  profile: ScoreProfile,
): ScoredIssue[] {
  return issues
    .map((issue) => scoreIssue(issue, repos.get(issue.repoFullName) ?? null, profile))
    .sort((a, b) => b.matchScore - a.matchScore);
}

/* ------------------------------------------------------------------------
 * Two-stage scoring, used by the background fetcher and the cached feed.
 *
 * Four of the six factors depend only on the issue and its repo, so the
 * fetcher computes them once and stores the result. The other two (language
 * fit, difficulty fit) plus the interest multiplier depend on who is asking,
 * so they are layered on at read time by calling `scoreIssue` on the stored
 * snapshot. Nothing here duplicates the weight maths above.
 * --------------------------------------------------------------------- */

/** The factors that are the same for every user. */
export const BASE_FACTORS = [
  "repoHealth",
  "freshness",
  "contention",
  "welcoming",
] as const;

export type BaseBreakdown = Pick<
  ScoreBreakdown,
  (typeof BASE_FACTORS)[number]
>;

/** Sum of the base weights, used to normalise `baseScore` back onto 0-1. */
export const BASE_WEIGHT_TOTAL = BASE_FACTORS.reduce(
  (sum, key) => sum + WEIGHTS[key],
  0,
);

/**
 * The user-independent portion of the score. Stored on the issue document as
 * the database-level sort key, so a feed page can be narrowed to plausible
 * candidates before the per-user factors are applied.
 */
export function scoreBase(
  issue: CandidateIssue,
  repo: RepoSignals | null,
): { baseScore: number; breakdown: BaseBreakdown } {
  const breakdown: BaseBreakdown = {
    repoHealth: scoreRepoHealth(repo),
    freshness: scoreFreshness(issue),
    contention: scoreContention(issue),
    welcoming: scoreWelcoming(repo, issue),
  };

  const weighted = BASE_FACTORS.reduce(
    (sum, key) => sum + breakdown[key] * WEIGHTS[key],
    0,
  );

  return {
    baseScore: Math.round((weighted / BASE_WEIGHT_TOTAL) * 1000) / 1000,
    breakdown,
  };
}
