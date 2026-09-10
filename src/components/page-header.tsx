import { cn } from "@/lib/utils";

/**
 * The editorial header from the landing, carried into the app: an eyebrow
 * with a rule, a mono title, an optional description, and an actions slot.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-iris">
            <span className="h-px w-6 bg-iris" />
            {eyebrow}
          </p>
        )}
        <h1 className="mt-3 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {children && <div className="mt-4 flex flex-wrap items-center gap-1.5">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A number with a label, for summary rows. Optionally acts as a filter button. */
export function StatTile({
  n,
  label,
  hint,
  active,
  onClick,
  tone = "default",
}: {
  n: number | string;
  label: string;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
  tone?: "default" | "iris" | "neon" | "amber";
}) {
  const toneCls = {
    default: "text-foreground",
    iris: "text-iris",
    neon: "text-neon",
    amber: "text-amber",
  }[tone];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "flex flex-col items-start rounded-xl border bg-card/70 px-4 py-3 text-left transition-colors",
        onClick && "hover:border-iris/50",
        active ? "border-iris bg-iris/5" : "border-border/70",
      )}
    >
      <span className={cn("font-mono text-2xl font-semibold tabular-nums leading-none", toneCls)}>{n}</span>
      <span className="mt-1.5 font-mono text-[11px] text-muted-foreground">{label}</span>
      {hint && <span className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</span>}
    </Comp>
  );
}
