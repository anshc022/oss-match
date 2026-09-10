import { z } from "zod";
import { structured } from "@/lib/llm";
import { score, type RepoActivitySummary } from "@/lib/mentor/getRepoActivity";

export const MentorsSchema = z.object({
  mentors: z
    .array(
      z.object({
        username: z.string(),
        reason: z.string().max(140),
      }),
    )
    .max(3),
});

export type Mentor = { username: string; avatarUrl: string; reason: string };

const SYSTEM = `You pick which people on an open-source repository a brand-new contributor should ask for help.

You will receive a JSON list of recently active people with counts of issue comments, pull-request reviews, and merged pull requests over the last 60 days, how recently they were active, whether they own the repo, and a couple of short excerpts of their comments.

Rules:
- Choose one to three people most likely to give a fast, helpful reply to a newcomer. Reviewing and commenting matter more than merging your own PRs.
- The repo owner is not automatically the right person. Often someone else does the day-to-day reviewing.
- Prefer people active within the last two weeks.
- Skip anyone whose only activity is merging their own work, and skip bots.
- Only choose usernames that appear in the list. Never invent one.
- Each reason is one short factual line grounded in the counts, such as "Reviewed 8 PRs this month" or "Answers most issue threads within a day". No adjectives about their character.
- If nobody is a reasonable contact, return an empty list.`;

export async function rankMentorsWithAI(activity: RepoActivitySummary): Promise<Mentor[] | null> {
  if (activity.people.length === 0) return [];
  const slim = activity.people.map((p) => ({
    username: p.username,
    isOwner: p.isOwner,
    comments: p.comments,
    reviews: p.reviews,
    mergedPrs: p.mergedPrs,
    lastActiveDaysAgo: p.lastActiveDaysAgo,
    samples: p.samples,
  }));
  const out = await structured({
    label: "mentors",
    reasoningEffort: "low",
    schema: MentorsSchema,
    system: SYSTEM,
    user: `Repository: ${activity.fullName}\nWindow: last ${activity.windowDays} days\n\n${JSON.stringify(slim, null, 1)}`,
    maxTokens: 3072,
    // Runs inside the cron window; a slow reply means the heuristic answers.
    timeoutMs: 15_000,
  });
  if (!out) return null;

  // Ground every pick in the real list; drop anything the model made up.
  const byName = new Map(activity.people.map((p) => [p.username.toLowerCase(), p]));
  return out.mentors
    .map((m) => {
      const person = byName.get(m.username.toLowerCase());
      return person ? { username: person.username, avatarUrl: person.avatarUrl, reason: m.reason } : null;
    })
    .filter((m): m is Mentor => m !== null)
    .slice(0, 3);
}

/** Deterministic fallback with a reason built from the counts. */
export function heuristicMentors(activity: RepoActivitySummary): Mentor[] {
  return activity.people
    .filter((p) => p.reviews + p.comments >= 2 && p.lastActiveDaysAgo <= 45)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 2)
    .map((p) => {
      const bits: string[] = [];
      if (p.reviews) bits.push(`reviewed ${p.reviews} PR${p.reviews === 1 ? "" : "s"}`);
      if (p.comments) bits.push(`${p.comments} issue comment${p.comments === 1 ? "" : "s"}`);
      const when = p.lastActiveDaysAgo <= 7 ? "this week" : p.lastActiveDaysAgo <= 30 ? "this month" : "recently";
      const reason = bits.length ? `${capitalize(bits.join(", "))} ${when}.` : `Active ${when}.`;
      return { username: p.username, avatarUrl: p.avatarUrl, reason };
    });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
