import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { SavedIssue } from "@/models/SavedIssue";
import { SkippedIssue } from "@/models/SkippedIssue";

export const dynamic = "force-dynamic";

type SavePayload = {
  action?: "save" | "skip";
  issueUrl?: string;
  issueNumber?: number;
  issueTitle?: string;
  issueBody?: string;
  repoName?: string;
  repoUrl?: string;
  cloneUrl?: string;
  defaultBranch?: string;
  language?: string;
  labels?: string[];
  matchScore?: number;
};

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: SavePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.issueUrl) {
    return NextResponse.json({ error: "issueUrl is required" }, { status: 400 });
  }

  await dbConnect();

  if (body.action === "skip") {
    await SkippedIssue.findOneAndUpdate(
      { userId: user._id, issueUrl: body.issueUrl },
      { userId: user._id, issueUrl: body.issueUrl, skippedAt: new Date() },
      { upsert: true },
    );
    return NextResponse.json({ ok: true, action: "skip" });
  }

  if (!body.repoName || !body.issueTitle || typeof body.issueNumber !== "number") {
    return NextResponse.json(
      { error: "repoName, issueTitle and issueNumber are required to save" },
      { status: 400 },
    );
  }

  const saved = await SavedIssue.findOneAndUpdate(
    { userId: user._id, issueUrl: body.issueUrl },
    {
      $setOnInsert: {
        userId: user._id,
        issueUrl: body.issueUrl,
        issueNumber: body.issueNumber,
        issueTitle: body.issueTitle,
        issueBody: (body.issueBody ?? "").slice(0, 2000),
        repoName: body.repoName,
        repoUrl: body.repoUrl ?? `https://github.com/${body.repoName}`,
        cloneUrl: body.cloneUrl ?? `https://github.com/${body.repoName}.git`,
        defaultBranch: body.defaultBranch || "main",
        language: body.language ?? "",
        labels: body.labels ?? [],
        matchScore: body.matchScore ?? 0,
        status: "saved",
        guideProgress: [],
        savedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  // Saving something previously skipped should clear the skip.
  await SkippedIssue.deleteOne({ userId: user._id, issueUrl: body.issueUrl });

  return NextResponse.json({ ok: true, action: "save", id: String(saved._id) });
}
