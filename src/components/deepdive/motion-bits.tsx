"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion, type Transition } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Physical, quick. Settles in roughly 250ms. */
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 };
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 28, mass: 0.9 };

export function useReduced() {
  return useReducedMotion() ?? false;
}

/** A number that counts up on first render. */
export function CountUp({ value, className, duration = 0.9 }: { value: number; className?: string; duration?: number }) {
  const reduced = useReduced();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setShown(value); return; }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration, reduced]);
  return <span className={cn("tabular-nums", className)}>{shown}</span>;
}

/** Copy button whose icon becomes a checkmark on success. */
export function CopyIconButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return (
    <motion.button
      type="button"
      aria-label={done ? "Copied" : label}
      whileTap={{ scale: 0.92 }}
      transition={SPRING}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 1400);
        } catch {
          // Clipboard blocked; nothing to show.
        }
      }}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition-colors hover:border-iris/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.span key="ok" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={SPRING}>
            <Check className="size-3.5 text-neon" />
          </motion.span>
        ) : (
          <motion.span key="copy" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={SPRING}>
            <Copy className="size-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Slide-and-fade wrapper for side panels. */
export function SlidePanel({ children, className, from = "right" }: { children: React.ReactNode; className?: string; from?: "right" | "bottom" }) {
  const reduced = useReduced();
  const off = from === "right" ? { x: 24 } : { y: 24 };
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, ...off }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, ...off }}
      transition={SPRING}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Throttle a pointer handler to one call per animation frame. */
export function useRafThrottle<T extends unknown[]>(fn: (...args: T) => void) {
  const frame = useRef<number | null>(null);
  const latest = useRef<T | null>(null);
  return (...args: T) => {
    latest.current = args;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (latest.current) fn(...latest.current);
    });
  };
}

/** Category → face colours, derived from the app's existing tokens. */
export const CATEGORY_HSL: Record<string, string> = {
  frontend: "var(--iris)",
  backend: "var(--cyan)",
  config: "var(--amber)",
  tests: "var(--rose)",
  docs: "var(--muted-foreground)",
  dir: "var(--iris)",
  file: "var(--muted-foreground)",
  highlight: "var(--cyan)",
};
