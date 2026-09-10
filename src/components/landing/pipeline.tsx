import { GUIDE_STEPS } from "@/lib/guide";
import { cn } from "@/lib/utils";

/**
 * The eight-step guide as a serpentine rail. Each row draws its own curved
 * connector, stretched to the row's height, so the path always meets the next
 * node no matter how tall the content is.
 */

const SAMPLE: Record<number, { kind: "cmd" | "note"; text: string }> = {
  1: { kind: "note", text: "Press Fork on github.com/excalidraw/excalidraw" },
  2: { kind: "cmd", text: "git clone https://github.com/you/excalidraw.git" },
  3: { kind: "note", text: "Setup, tests and commit style, pulled from CONTRIBUTING.md" },
  4: { kind: "cmd", text: "git checkout -b fix/8412-announce-duplicate" },
  5: { kind: "note", text: "Small diff. Run the tests before you push." },
  6: { kind: "cmd", text: "git commit -m \"fix: announce duplicate to screen readers\"" },
  7: { kind: "cmd", text: "git push -u origin fix/8412-announce-duplicate" },
  8: { kind: "note", text: "Push follow-ups to the same branch. Reply to every comment." },
};

export function Pipeline() {
  return (
    <ol className="relative">
      {GUIDE_STEPS.map((step, i) => {
        const last = i === GUIDE_STEPS.length - 1;
        const sample = SAMPLE[step.id];
        const bulge = i % 2 === 0 ? 1 : -1;

        return (
          <li
            key={step.id}
            className="relative grid grid-cols-[64px_1fr] gap-x-4 sm:grid-cols-[88px_1fr] sm:gap-x-8"
          >
            {/* Rail */}
            <div className="relative flex justify-center">
              <span
                className={cn(
                  "relative z-10 mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-background font-mono text-xs font-semibold tabular-nums",
                  i === 0 ? "border-iris text-iris" : "border-border text-foreground",
                )}
              >
                {String(step.id).padStart(2, "0")}
                {i === 0 && (
                  <span className="absolute inset-0 rounded-full border border-iris/50 animate-pulse-ring" />
                )}
              </span>
              {!last && (
                <svg
                  className="absolute left-0 top-10 h-[calc(100%-2.5rem)] w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d={`M50 0 C50 40, ${50 + bulge * 34} 60, 50 100`}
                    className="stroke-border"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={`M50 0 C50 40, ${50 + bulge * 34} 60, 50 100`}
                    className="stroke-iris/70 stroke-dash"
                    strokeWidth="2"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ ["--dash" as string]: 160, animationDelay: `${i * 0.25}s` }}
                  />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className={cn("pb-10", last && "pb-0")}>
              <h3 className="font-mono text-base font-medium sm:text-lg">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.blurb}</p>
              <div
                className={cn(
                  "mt-3 inline-flex max-w-full items-center gap-2 rounded-md border px-3 py-2 font-mono text-[12px]",
                  sample.kind === "cmd"
                    ? "border-border bg-card text-foreground"
                    : "border-dashed border-border/80 text-muted-foreground",
                )}
              >
                {sample.kind === "cmd" && <span className="select-none text-iris">$</span>}
                <span className="truncate">{sample.text}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
