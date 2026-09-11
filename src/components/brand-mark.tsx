import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * The mark: a trunk that splits into two branches, which is a fork in both
 * senses the product cares about. Built from the same rounded blocks the rest
 * of the interface uses, so it sits naturally next to the UI.
 *
 * Drawn on a 24-unit grid with 3-unit strokes, which keeps every edge on a
 * whole pixel at 16, 24, 32 and 48px. That is what stops a favicon going
 * mushy at tab size.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* Trunk: where every contributor starts. */}
      <path
        d="M7.5 21v-4.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-iris"
      />
      {/* The split. */}
      <path
        d="M7.5 16.5v-3a3 3 0 0 1 3-3h6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-iris"
      />
      {/* Origin node, and the branch you create. */}
      <circle cx="7.5" cy="21" r="0.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-iris" />
      <circle cx="7.5" cy="6" r="0.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-iris" />
      <path d="M7.5 10.5V6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-iris" />
      {/* The branch that lands: picked out in cyan, the colour the app already
          uses for "this is the part that is yours". */}
      <circle cx="18" cy="10.5" r="0.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-neon" />
    </svg>
  );
}

/** Mark plus wordmark, as used in the header and on social cards. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark className="size-5 shrink-0" />
      <span className="font-mono text-sm font-semibold tracking-tight">
        {BRAND.wordmark.lead}
        <span className="text-primary">/</span>
        {BRAND.wordmark.tail}
      </span>
    </span>
  );
}
