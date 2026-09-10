import type { SimpleIcon } from "simple-icons";
import { cn } from "@/lib/utils";

/**
 * Renders a simple-icons mark. Fills with the current text colour by default
 * so it sits quietly in both themes; on hover the brand colour comes through
 * via the `--brand` variable the parent sets.
 */
export function BrandIcon({
  icon,
  className,
  brand = false,
}: {
  icon: SimpleIcon;
  className?: string;
  /** Render in the brand colour immediately instead of on hover. */
  brand?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={icon.title}
      className={cn("size-4 shrink-0", className)}
      style={{ ["--brand" as string]: `#${icon.hex}` }}
      fill={brand ? `#${icon.hex}` : "currentColor"}
    >
      <path d={icon.path} />
    </svg>
  );
}
