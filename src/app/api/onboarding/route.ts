import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  INTERESTS,
  SKILL_LEVELS,
  TIME_AVAILABILITY,
  type Interest,
  type SkillLevel,
  type TimeAvailability,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

type OnboardingPayload = {
  skillLevel?: SkillLevel;
  interests?: Interest[];
  languages?: string[];
  timeAvailability?: TimeAvailability;
};

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: OnboardingPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.skillLevel || !SKILL_LEVELS.includes(body.skillLevel)) {
    return NextResponse.json({ error: "Pick a skill level" }, { status: 400 });
  }
  if (!body.timeAvailability || !TIME_AVAILABILITY.includes(body.timeAvailability)) {
    return NextResponse.json({ error: "Pick a time commitment" }, { status: 400 });
  }
  const languages = (body.languages ?? []).filter(
    (l) => typeof l === "string" && l.length > 0 && l.length < 40,
  );
  if (languages.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one language" },
      { status: 400 },
    );
  }

  user.skillLevel = body.skillLevel;
  user.timeAvailability = body.timeAvailability;
  user.languages = languages.slice(0, 12);
  user.interests = (body.interests ?? []).filter((i) => INTERESTS.includes(i));
  user.onboardedAt = new Date();
  await user.save();

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json({
    skillLevel: user.skillLevel,
    interests: user.interests ?? [],
    languages: user.languages ?? [],
    timeAvailability: user.timeAvailability,
    suggestedLanguages: user.suggestedLanguages ?? [],
    onboarded: Boolean(user.onboardedAt),
  });
}
