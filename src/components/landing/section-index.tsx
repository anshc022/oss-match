/** Editorial section header: a big faint numeral behind a short label and title. */
export function SectionIndex({
  n,
  label,
  title,
  children,
}: {
  n: string;
  label: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-2 -top-10 select-none font-mono text-[9rem] font-semibold leading-none text-foreground/[0.07] sm:-top-14 sm:text-[12rem]"
      >
        {n}
      </span>
      <div className="relative">
        <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-iris">
          <span className="h-px w-8 bg-iris" />
          {label}
        </p>
        <h2 className="mt-4 max-w-2xl font-mono text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        {children && (
          <div className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
