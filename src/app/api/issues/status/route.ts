import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { currentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { SavedIssue } from "@/models/SavedIssue";
import { GUIDE_STEPS } from "@/lib/guide";
import { ISSUE_STATUSES, type IssueStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

type StatusPayload = {
  id?: string;
  status?: IssueStatus;
  /** Toggle a single step. */
  step?: number;
  completed?: boolean;
  /** Or replace the whole set at once. */
  guideProgress?: number[];
};

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: StatusPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  // Without this, Mongoose throws a CastError and the route 500s.
  if (!mongoose.isValidObjectId(body.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await dbConnect();
  // Scoped to userId so one user can never mutate another's saved issue.
  const issue = await SavedIssue.findOne({ _id: body.id, userId: user._id });
  if (!issue) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.status) {
    if (!ISSUE_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    issue.status = body.status;
  }

  if (Array.isArray(body.guideProgress)) {
    issue.guideProgress = normalize(body.guideProgress);
  } else if (typeof body.step === "number") {
    const step = body.step;
    if (step < 1 || step > GUIDE_STEPS.length) {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }
    const set = new Set(issue.guideProgress ?? []);
    if (body.completed === false) set.delete(step);
    else set.add(step);
    issue.guideProgress = normalize(Array.from(set));
  }

  // Starting the guide moves a saved issue to in-progress; finishing it does
  // not auto-claim a contribution, since only a merged PR earns that.
  if (!body.status && issue.guideProgress.length > 0 && issue.status === "saved") {
    issue.status = "in-progress";
  }

  await issue.save();

  return NextResponse.json({
    ok: true,
    issue: {
      ...issue.toObject(),
      _id: String(issue._id),
      userId: String(issue.userId),
    },
  });
}

function normalize(steps: number[]) {
  return Array.from(
    new Set(
      steps.filter(
        (s) => Number.isInteger(s) && s >= 1 && s <= GUIDE_STEPS.length,
      ),
    ),
  ).sort((a, b) => a - b);
}
