import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { SavedIssue } from "@/models/SavedIssue";
import { GUIDE_STEPS } from "@/lib/guide";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await dbConnect();
  const issues = await SavedIssue.find({ userId: user._id })
    .sort({ savedAt: -1 })
    .lean();

  return NextResponse.json({
    issues: issues.map((i) => ({
      ...i,
      _id: String(i._id),
      userId: String(i.userId),
      totalSteps: GUIDE_STEPS.length,
    })),
  });
}
