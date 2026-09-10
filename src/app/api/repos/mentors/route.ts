import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readMentors, refreshMentorsInBackground } from "@/lib/mentor/getMentors";
import { llmAvailable } from "@/lib/llm";

export const dynamic = "force-dynamic";
// The refresh now runs through waitUntil rather than being dropped when the
// response is sent, so the instance has to be allowed to live long enough to
// finish it: roughly ten GitHub calls plus one bounded model call.
export const maxDuration = 60;

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

/**
 * Returns the cached suggestion immediately. If it is missing or older than a
 * week, a refresh starts in the background and the next request sees it.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo || !REPO_RE.test(repo)) {
    return NextResponse.json({ error: "repo must be in owner/name form" }, { status: 400 });
  }

  const result = await readMentors(repo);
  if (result.stale) refreshMentorsInBackground(repo);

  return NextResponse.json({
    ...result,
    computing: result.stale && result.mentors.length === 0,
    aiEnabled: llmAvailable(),
  });
}
