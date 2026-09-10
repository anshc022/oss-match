import { z } from "zod";
import { structured } from "@/lib/llm";
import { SKILL_LEVELS, type SkillLevel } from "@/lib/constants";
import type { ActivitySummary } from "@/lib/skillgraph/collectUserActivity";

export const SkillGraphSchema = z.object({
  languageSkills: z
    .array(
      z.object({
        language: z.string(),
        level: z.enum(SKILL_LEVELS),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(10),
  overallTier: z.enum(SKILL_LEVELS),
  summary: z.string().max(600),
});

export type SkillGraph = z.infer<typeof SkillGraphSchema> & {
  source: "ai" | "heuristic";
  computedAt: Date;
  evidence: { repos: number; commits: number; mergedPrs: number };
};

const SYSTEM = `You assess a developer's practical proficiency from their real GitHub activity.

You will receive a JSON summary: their non-fork repositories with commit counts, their merged pull requests with size, and per-language aggregates.

Rules:
- Judge depth of use, not breadth. Thirty commits and two merged PRs in one language outweigh ten single-commit repos in another.
- Merged PRs into repositories the user does not own are the strongest signal: they mean the work passed someone else's review.
- Large PRs (hundreds of changed lines across several files) indicate more than small ones, but many small merged PRs still indicate fluency.
- Only include a language if there is real evidence for it. Leave out languages with a single trivial repo and no PRs.
- Confidence reflects how much evidence you had, on a 0-1 scale. Sparse data means low confidence, never a guess dressed up as certainty.
- overallTier: "beginner" if there is little evidence of shipping to shared codebases; "advanced" only with sustained, reviewed work across non-trivial changes; otherwise "intermediate".
- The summary is two to three plain sentences about what they have actually done well, written to the developer. No flattery, no hedging filler.`;

/** Ask the model for the skill graph. Null when it is unavailable or the reply fails validation. */
export async function analyzeSkillWithAI(
  summary: ActivitySummary,
): Promise<z.infer<typeof SkillGraphSchema> | null> {
  const slim = {
    username: summary.username,
    totals: summary.totals,
    languages: summary.languages,
    repos: summary.repos.map((r) => ({
      repo: r.fullName,
      language: r.language,
      commits: r.commits,
      stars: r.stars,
      topics: r.topics.slice(0, 6),
      lastCommitDaysAgo: r.lastCommitDaysAgo,
    })),
    mergedPrs: summary.mergedPrs.map((p) => ({
      repo: p.repo,
      language: p.language,
      title: p.title.slice(0, 120),
      additions: p.additions,
      deletions: p.deletions,
      changedFiles: p.changedFiles,
      mergedAt: p.mergedAt,
    })),
  };

  return structured({
    label: "skillgraph",
    schema: SkillGraphSchema,
    system: SYSTEM,
    user: `Assess this developer.\n\n${JSON.stringify(slim, null, 1)}`,
    maxTokens: 6144,
    // User-triggered with a spinner, so it may wait for a reasoning model.
    timeoutMs: 150_000,
  });
}

/**
 * Deterministic fallback when the model is not configured or fails. Uses the same
 * evidence, so the profile still reflects real activity rather than reverting
 * to nothing. Marked `heuristic` so the UI can say so.
 */
export function heuristicSkillGraph(summary: ActivitySummary): z.infer<typeof SkillGraphSchema> {
  const rows = Object.entries(summary.languages)
    .map(([language, s]) => {
      // Evidence points: commits are cheap, merged PRs are not.
      const points = s.commits * 1 + s.prs * 12 + Math.min(s.linesChanged, 3000) / 60;
      let level: SkillLevel = "beginner";
      if (points >= 90 && s.prs >= 2) level = "advanced";
      else if (points >= 25) level = "intermediate";
      const confidence = Math.max(0.15, Math.min(0.85, points / 120));
      return { language, level, confidence: Math.round(confidence * 100) / 100, points };
    })
    .filter((r) => r.points >= 3)
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);

  const totalPrs = summary.totals.mergedPrs;
  const overallTier: SkillLevel =
    totalPrs >= 5 && rows.some((r) => r.level === "advanced")
      ? "advanced"
      : totalPrs >= 1 || summary.totals.commits >= 40
        ? "intermediate"
        : "beginner";

  const top = rows.slice(0, 3).map((r) => r.language).join(", ");
  const summaryText = summary.sparse
    ? "Not much public activity to go on yet. This profile leans on your self-reported level until there is more shipped code to read."
    : `Most of your public work is in ${top || "a few languages"}, across ${summary.totals.repos} repos with ${summary.totals.commits} recent commits${totalPrs ? ` and ${totalPrs} merged pull request${totalPrs === 1 ? "" : "s"}` : ""}. Computed from activity counts; add an LLM key for a written assessment.`;

  return {
    languageSkills: rows.map(({ language, level, confidence }) => ({ language, level, confidence })),
    overallTier,
    summary: summaryText,
  };
}
