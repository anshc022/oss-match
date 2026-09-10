import { WEIGHTS } from "@/lib/scoring";
import { FACTOR_TONES } from "@/lib/factor-tones";
import { cn } from "@/lib/utils";

/**
 * The scoring formula drawn as one proportional bar, so the reader sees the
 * weights as areas rather than as a list of percentages.
 */

const FACTORS = [
  { key: "language", label: "Language", cls: FACTOR_TONES.language.bg, text: FACTOR_TONES.language.text, copy: "Exact match to what you write. Adjacent languages get partial credit." },
  { key: "difficulty", label: "Difficulty", cls: FACTOR_TONES.difficulty.bg, text: FACTOR_TONES.difficulty.text, copy: "Labels mapped to your level. Never a filter, only a reorder." },
  { key: "repoHealth", label: "Repo health", cls: FACTOR_TONES.repoHealth.bg, text: FACTOR_TONES.repoHealth.text, copy: "A push in the last 30 days beats a dead repo with 40k stars." },
  { key: "contention", label: "Unclaimed", cls: FACTOR_TONES.contention.bg, text: FACTOR_TONES.contention.text, copy: "Quiet threads rank first. Twenty comments is a queue." },
  { key: "freshness", label: "Freshness", cls: FACTOR_TONES.freshness.bg, text: FACTOR_TONES.freshness.text, copy: "Opened this week is ideal. Two years old is stale, not hidden." },
  { key: "welcoming", label: "Welcoming", cls: FACTOR_TONES.welcoming.bg, text: FACTOR_TONES.welcoming.text, copy: "CONTRIBUTING.md and a code of conduct mean they expect you." },
] as const;

export function ScoreAnatomy() {
  return (
    <div className="w-full">
      {/* The bar */}
      <div className="flex h-16 w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:h-20">
        {FACTORS.map((f, i) => {
          const pct = Math.round(WEIGHTS[f.key] * 100);
          return (
            <div
              key={f.key}
              className={cn(
                "relative flex items-end justify-start overflow-hidden p-2 animate-rise-in",
                f.cls,
                i > 0 && "border-l border-background/40",
              )}
              style={{ width: `${pct}%`, animationDelay: `${i * 90}ms` }}
            >
              <span className="font-mono text-xs font-semibold tabular-nums text-background sm:text-sm">
                {pct}
              </span>
            </div>
          );
        })}
      </div>

      {/* Leader lines and labels */}
      <div className="flex w-full">
        {FACTORS.map((f) => (
          <div
            key={f.key}
            className="min-w-0"
            style={{ width: `${Math.round(WEIGHTS[f.key] * 100)}%` }}
          >
            <div className={cn("mx-2 h-6 w-px", f.cls)} />
          </div>
        ))}
      </div>

      <ol className="grid gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
        {FACTORS.map((f, i) => (
          <li
            key={f.key}
            className="animate-rise-in"
            style={{ animationDelay: `${300 + i * 70}ms` }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className={cn("font-mono text-sm font-medium", f.text)}>{f.label}</h3>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                ×{WEIGHTS[f.key].toFixed(2)}
              </span>
            </div>
            <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-muted-foreground">
              {f.copy}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
