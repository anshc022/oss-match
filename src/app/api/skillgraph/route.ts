import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { computeSkillGraph, skillGraphStale } from "@/lib/skillgraph/computeSkillGraph";
import { llmAvailable } from "@/lib/llm";

export const dynamic = "force-dynamic";
// Collecting ~40 GitHub calls plus a reasoning-model reply is slow, and 60s is
// the ceiling on Vercel's Hobby plan. A refresh cut short still saves the
// heuristic result, and the next visit picks the work back up.
export const maxDuration = 60;

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({
    skillGraph: user.skillGraph ?? null,
    status: user.skillGraphStatus ?? "idle",
    error: user.skillGraphError ?? "",
    stale: skillGraphStale(user.skillGraph?.computedAt),
    aiEnabled: llmAvailable(),
  });
}

/** Manual "Refresh my skill profile". Also used by the profile page's first-run trigger. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const force = new URL(req.url).searchParams.get("force") === "true";
  const result = await computeSkillGraph(String(user._id), { force });

  if (!result.ok && result.reason === "already computing") {
    return NextResponse.json({ ok: false, status: "computing" }, { status: 202 });
  }
  return NextResponse.json({ ok: result.ok, reason: result.reason, skillGraph: result.graph ?? null });
}
