import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { readDeepDive, startDeepDiveInBackground } from "@/lib/deepdive/getDeepDive";
import { STAGE_COPY } from "@/lib/deepdive/types";
import { llmAvailable } from "@/lib/llm";

export const dynamic = "force-dynamic";

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

/**
 * Returns whatever is cached right away. If the report is missing, stale, or
 * this issue has not been mapped yet, generation starts in the background and
 * the response carries the current stage for the client to show and poll.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(req.url);
  const repo = url.searchParams.get("repo");
  const issueId = url.searchParams.get("issue") ?? undefined;
  if (!repo || !REPO_RE.test(repo)) return NextResponse.json({ error: "repo must be owner/name" }, { status: 400 });
  if (issueId && !mongoose.isValidObjectId(issueId)) return NextResponse.json({ error: "bad issue id" }, { status: 400 });

  const read = await readDeepDive(repo, issueId);
  const needsWork = read.stage === "idle" || read.stage === "error";
  if (needsWork) startDeepDiveInBackground(repo, issueId);

  return NextResponse.json({
    stage: needsWork ? "tree" : read.stage,
    stageLabel: STAGE_COPY[needsWork ? "tree" : read.stage],
    deepDive: read.deepDive,
    location: read.location,
    error: read.error,
    aiEnabled: llmAvailable(),
  });
}
