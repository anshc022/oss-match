"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { GrainGradient } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Dial the whole effect down further on dense pages. */
  opacity?: number;
};

/**
 * Ambient background glow. Deliberately low contrast and heavily blurred: it
 * reads as a light source behind the page, not as artwork competing with it.
 */
const PALETTE = {
  dark: { back: "#08060f", colors: ["#2a1b5e", "#5b3fd6", "#0d4a63", "#0a0714"] },
  light: { back: "#f7f5fd", colors: ["#e6dcff", "#c9b8ff", "#cdeef6", "#f7f5fd"] },
};

export function ShaderBackground({ className, opacity = 0.5 }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const palette = PALETTE[mounted && resolvedTheme === "light" ? "light" : "dark"];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <GrainGradient
        style={{ width: "100%", height: "100%", opacity }}
        colorBack={palette.back}
        colors={palette.colors}
        softness={0.9}
        intensity={0.34}
        noise={0.32}
        shape="corners"
        speed={reduceMotion ? 0 : 0.28}
      />
      {/* Vignette + floor so text always lands on near-solid background. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,hsl(var(--background)/0.55)_45%,hsl(var(--background))_85%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
