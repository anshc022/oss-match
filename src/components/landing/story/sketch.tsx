"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The hand-drawn layer of the story: things that pop in as you scroll and
 * lines that draw themselves. All of it degrades to static when the reader
 * prefers reduced motion, and none of it is needed to understand the page.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade and rise into view once, staggered by `delay` seconds. */
export function Reveal({
  children,
  delay = 0,
  className,
  from = "up",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  from?: "up" | "scale";
}) {
  const reduced = useReducedMotion();
  const initial = reduced ? false : from === "scale" ? { opacity: 0, scale: 0.72, y: 10 } : { opacity: 0, y: 18 };
  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** A path that draws itself in when scrolled into view. */
export function DrawPath({
  d,
  delay = 0,
  duration = 0.9,
  className,
  strokeWidth = 2,
  arrow = false,
}: {
  d: string;
  delay?: number;
  duration?: number;
  className?: string;
  strokeWidth?: number;
  /** Put an arrowhead on the end. */
  arrow?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      className={className}
      markerEnd={arrow ? "url(#sketch-arrow)" : undefined}
      initial={reduced ? false : { pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ pathLength: { duration, delay, ease: "easeInOut" }, opacity: { duration: 0.2, delay } }}
    />
  );
}

/** Shared arrowhead marker. Render once per SVG that uses `arrow`. */
export function SketchDefs() {
  return (
    <defs>
      <marker id="sketch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M1 1.5 L8.5 5 L1 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
    </defs>
  );
}

/**
 * The tangle above the overwhelmed newcomer's head. Deterministic, so the
 * server and client draw the same scribble and hydration stays clean.
 */
export function Scribble({ className, delay = 0.3 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 160 110" className={cn("overflow-visible", className)} aria-hidden>
      <DrawPath d={SCRIBBLE} delay={delay} duration={1.6} strokeWidth={1.7} />
    </svg>
  );
}

const SCRIBBLE = (() => {
  // A spiral of loops. Fixed constants rather than Math.random so the path is
  // identical on every render.
  const pts: string[] = [];
  const cx = 80, cy = 56;
  for (let i = 0; i <= 260; i++) {
    const t = i / 260;
    const a = t * Math.PI * 14;
    const r = 6 + t * 40 + 9 * Math.sin(a * 0.9);
    const x = cx + Math.cos(a) * r * 1.35 + 5 * Math.sin(t * 31);
    const y = cy + Math.sin(a) * r * 0.85 + 4 * Math.cos(t * 23);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
})();

/** Handwritten note, slightly tilted, in the annotation ink. */
export function Note({
  children,
  className,
  tilt = -3,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  tilt?: number;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className={cn("font-hand text-[1.05rem] leading-tight text-[var(--ink-soft)]", className)}>
      <span style={{ display: "block", transform: `rotate(${tilt}deg)` }}>{children}</span>
    </Reveal>
  );
}
