/**
 * One colour per scoring factor, used identically on the landing bar, the
 * feed cards, the list rows and the detail page, so a reader learns the
 * mapping once. Iris for the user-fit factors, cyan for repo signals, amber
 * and rose for time and welcome.
 */
export const FACTOR_TONES = {
  language: { label: "language", bg: "bg-iris", text: "text-iris" },
  difficulty: { label: "difficulty fit", bg: "bg-iris/60", text: "text-iris" },
  repoHealth: { label: "repo health", bg: "bg-neon", text: "text-neon" },
  contention: { label: "unclaimed", bg: "bg-neon/60", text: "text-neon" },
  freshness: { label: "freshness", bg: "bg-amber", text: "text-amber" },
  welcoming: { label: "welcoming", bg: "bg-rose", text: "text-rose" },
} as const;

export type FactorKey = keyof typeof FACTOR_TONES;

export function factorTone(key: string) {
  return (FACTOR_TONES as Record<string, (typeof FACTOR_TONES)[FactorKey]>)[key] ?? {
    label: key,
    bg: "bg-primary",
    text: "text-primary",
  };
}
