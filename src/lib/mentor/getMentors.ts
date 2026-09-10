import { dbConnect } from "@/lib/mongodb";
import { RepoMeta } from "@/models/RepoMeta";
import { fetcherOctokit } from "@/lib/github-app-client";
import { RateLimitedQueue } from "@/lib/fetcher/limiter";
import { getRepoActivity } from "@/lib/mentor/getRepoActivity";
import { heuristicMentors, rankMentorsWithAI, type Mentor } from "@/lib/mentor/rankMentors";

export const MENTORS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** A heuristic answer is a placeholder; let the model replace it sooner. */
export const HEURISTIC_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function mentorsStale(computedAt: Date | null | undefined, source?: string) {
  if (!computedAt) return true;
  const maxAge = source === "heuristic" ? HEURISTIC_MAX_AGE_MS : MENTORS_MAX_AGE_MS;
  return Date.now() - new Date(computedAt).getTime() > maxAge;
}

export type MentorResult = {
  mentors: Mentor[];
  source: "ai" | "heuristic" | "";
  computedAt: Date | null;
  stale: boolean;
};

/** Cached read. Never calls GitHub or the model. */
export async function readMentors(fullName: string): Promise<MentorResult> {
  await dbConnect();
  const doc = await RepoMeta.findOne({ fullName }).select("mentors mentorsSource mentorsComputedAt").lean();
  return {
    mentors: (doc?.mentors ?? []) as Mentor[],
    source: (doc?.mentorsSource ?? "") as MentorResult["source"],
    computedAt: doc?.mentorsComputedAt ?? null,
    stale: mentorsStale(doc?.mentorsComputedAt, doc?.mentorsSource),
  };
}

/** One computation per repo at a time within this process. */
const inFlight = new Set<string>();

/**
 * Compute and cache suggested contacts for a repo. Runs from the cron cycle
 * and from an on-demand background trigger; a page never awaits this.
 */
export async function computeMentors(
  fullName: string,
  queue = new RateLimitedQueue(),
): Promise<MentorResult> {
  if (inFlight.has(fullName)) return readMentors(fullName);
  inFlight.add(fullName);
  try {
    await dbConnect();
    const { octokit } = fetcherOctokit();
    const activity = await getRepoActivity(fullName, octokit, queue);
    if (!activity) return readMentors(fullName);

    const fromAI = await rankMentorsWithAI(activity);
    const mentors = fromAI ?? heuristicMentors(activity);
    const source = fromAI ? "ai" : "heuristic";

    await RepoMeta.updateOne(
      { fullName },
      { $set: { mentors, mentorsSource: source, mentorsComputedAt: new Date() } },
      { upsert: true },
    );
    console.log(`[mentors] ${fullName}: ${mentors.length} via ${source} (${activity.people.length} active people)`);
    return { mentors, source, computedAt: new Date(), stale: false };
  } catch (err) {
    console.error(`[mentors] ${fullName} failed:`, err);
    return readMentors(fullName);
  } finally {
    inFlight.delete(fullName);
  }
}

/** Kick off a refresh without waiting for it. */
export function refreshMentorsInBackground(fullName: string) {
  void computeMentors(fullName);
}
