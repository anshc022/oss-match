import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ShaderBackground } from "@/components/shader-background";
import { OnboardingFlow } from "@/components/onboarding-flow";
import type { Interest, SkillLevel, TimeAvailability } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  return (
    <main className="relative min-h-dvh">
      <ShaderBackground opacity={0.4} />
      <div className="container flex min-h-dvh items-center justify-center py-16">
        <OnboardingFlow
          username={user.username}
          avatarUrl={user.avatarUrl}
          name={user.name}
          initial={{
            skillLevel: (user.skillLevel as SkillLevel | null) ?? null,
            interests: (user.interests ?? []) as Interest[],
            languages: user.languages ?? [],
            timeAvailability:
              (user.timeAvailability as TimeAvailability | null) ?? null,
          }}
          suggestedLanguages={user.suggestedLanguages ?? []}
          alreadyOnboarded={Boolean(user.onboardedAt)}
        />
      </div>
    </main>
  );
}
