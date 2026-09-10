import type { Interest, SkillLevel } from "@/lib/constants";
import type { LanguageSkill, ScoreProfile } from "@/lib/scoring";

type UserLike = {
  languages?: string[];
  suggestedLanguages?: string[];
  interests?: string[];
  skillLevel?: string | null;
  skillGraph?: {
    languageSkills?: LanguageSkill[];
    overallTier?: string;
  } | null;
};

/**
 * The scoring profile for a user. The computed skill graph, when present,
 * supplies both the per-language evidence and the overall tier used for
 * difficulty fit; the onboarding answers remain the fallback.
 */
export function scoreProfileFor(user: UserLike): ScoreProfile {
  const graph = user.skillGraph;
  const languageSkills = graph?.languageSkills?.length ? graph.languageSkills : undefined;
  const skillLevel = (graph?.overallTier ?? user.skillLevel ?? "beginner") as SkillLevel;
  return {
    languages: user.languages?.length ? user.languages : (user.suggestedLanguages ?? []),
    interests: (user.interests ?? []) as Interest[],
    skillLevel,
    languageSkills,
  };
}
