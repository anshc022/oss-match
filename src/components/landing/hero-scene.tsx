"use client";

import { useEffect, useRef, useState } from "react";
import { CircleDot, GitFork, MessageSquare, Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The hero's centrepiece: three issue cards in real CSS perspective, sitting
 * over an isometric floor, with a scoring gauge reading them. Tilts a few
 * degrees toward the pointer so the depth is felt, not implied.
 */

type SceneCard = {
  repo: string;
  title: string;
  lang: string;
  stars: string;
  forks: string;
  comments: number;
  labels: string[];
  score: number;
  tone: "iris" | "neon" | "amber";
};

const CARDS: SceneCard[] = [
  {
    repo: "excalidraw/excalidraw",
    title: "Duplicate shortcut is not announced to screen readers",
    lang: "TypeScript",
    stars: "82k",
    forks: "7.8k",
    comments: 1,
    labels: ["good first issue", "a11y"],
    score: 94,
    tone: "iris",
  },
  {
    repo: "tldraw/tldraw",
    title: "Add a tooltip to the lock button in the style panel",
    lang: "TypeScript",
    stars: "36k",
    forks: "2.3k",
    comments: 2,
    labels: ["good first issue", "help wanted"],
    score: 88,
    tone: "neon",
  },
  {
    repo: "pallets/flask",
    title: "Clearer error when the config file cannot be parsed",
    lang: "Python",
    stars: "68k",
    forks: "16k",
    comments: 4,
    labels: ["good first issue"],
    score: 81,
    tone: "amber",
  },
];

const TONE = {
  iris: { text: "text-iris", bar: "bg-iris", glow: "shadow-[0_30px_80px_-20px_hsl(var(--iris)/0.55)]" },
  neon: { text: "text-neon", bar: "bg-neon", glow: "shadow-[0_30px_80px_-20px_hsl(var(--cyan)/0.45)]" },
  amber: { text: "text-amber", bar: "bg-amber", glow: "shadow-[0_30px_80px_-20px_hsl(var(--amber)/0.4)]" },
};

/**
 * Explicit placements rather than a formula: the front card leads, one sits
 * back and up-right, one back and down-left, so every card shows an edge.
 * Percentages translate relative to the card's own box.
 */
const PLACEMENT = [
  { x: 22, y: 42, z: 140, rot: -3, w: 62 },
  { x: 62, y: 6, z: -60, rot: 5, w: 56 },
  { x: -6, y: 118, z: -140, rot: -7, w: 54 },
];

export function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    function onMove(e: PointerEvent) {
      const r = el!.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x: py * -6, y: px * 8 });
    }
    function onLeave() {
      setTilt({ x: 0, y: 0 });
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [reduce]);

  return (
    <div
      ref={ref}
      className="scene relative mx-auto aspect-[4/3] w-full max-w-[640px] select-none"
      aria-hidden
    >
      {/* Isometric floor */}
      <svg
        viewBox="0 0 640 480"
        className="absolute inset-0 h-full w-full"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(var(--iris))" stopOpacity="0" />
            <stop offset="0.55" stopColor="hsl(var(--iris))" stopOpacity="0.28" />
            <stop offset="1" stopColor="hsl(var(--iris))" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="0.6" r="0.6">
            <stop offset="0" stopColor="hsl(var(--iris))" stopOpacity="0.35" />
            <stop offset="1" stopColor="hsl(var(--iris))" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="640" height="480" fill="url(#glow)" />
        <g stroke="url(#floorFade)" strokeWidth="1">
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`a${i}`} x1={-80 + i * 70} y1="480" x2={200 + i * 70} y2="180" />
          ))}
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`b${i}`} x1={720 - i * 70} y1="480" x2={440 - i * 70} y2="180" />
          ))}
        </g>
      </svg>

      {/* Score gauge */}
      <div className="absolute right-[4%] top-[58%] z-30 flex size-[118px] items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-iris/40 animate-pulse-ring" />
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
          <circle cx="60" cy="60" r="52" className="stroke-border" strokeWidth="6" fill="none" />
          <circle
            cx="60"
            cy="60"
            r="52"
            className="stroke-iris stroke-dash"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            style={{ ["--dash" as string]: 327, strokeDasharray: 327, strokeDashoffset: 327 * (1 - 0.94) }}
          />
        </svg>
        <div className="relative rounded-full bg-background/80 px-3 py-2 text-center backdrop-blur">
          <div className="font-mono text-3xl font-semibold tabular-nums leading-none">94</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            match
          </div>
        </div>
      </div>

      {/* Card stack in real 3D */}
      <div
        className="preserve-3d absolute inset-0 transition-transform duration-500 ease-out"
        style={{ transform: `rotateX(${14 + tilt.x}deg) rotateY(${-16 + tilt.y}deg)` }}
      >
        {CARDS.map((card, i) => (
          <Card3D key={card.repo} card={card} index={i} reduce={reduce} />
        ))}
      </div>
    </div>
  );
}

function Card3D({ card, index, reduce }: { card: SceneCard; index: number; reduce: boolean }) {
  const t = TONE[card.tone];
  const { x, y, z, rot, w } = PLACEMENT[index];

  // The 3D placement and the float animation both need `transform`, and an
  // animation overrides an inline transform outright. So the placement lives
  // on this outer element and the float on the inner one.
  return (
    <div
      className="preserve-3d absolute left-0 top-0"
      style={{
        width: `${w}%`,
        transform: `translate3d(${x}%, ${y}%, ${z}px) rotateZ(${rot}deg)`,
        zIndex: 20 - index,
      }}
    >
      <div
        className={cn(
          "rounded-xl border border-border/80 bg-card p-4",
          t.glow,
          !reduce && "animate-float",
        )}
        style={{ animationDelay: `${index * 0.9}s`, opacity: 1 - index * 0.08 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] text-muted-foreground">{card.repo}</p>
            <div className="mt-1.5 flex items-center gap-2.5 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Star className="size-2.5" />{card.stars}</span>
              <span className="flex items-center gap-1"><GitFork className="size-2.5" />{card.forks}</span>
              <span className={t.text}>{card.lang}</span>
            </div>
          </div>
          <div className={cn("shrink-0 font-mono text-xl font-semibold tabular-nums", t.text)}>
            {card.score}
          </div>
        </div>

        <p className="mt-3 text-pretty text-[13px] font-medium leading-snug">{card.title}</p>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {card.labels.map((l) => (
              <span key={l} className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                {l}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <CircleDot className="size-2.5" />
            <MessageSquare className="size-2.5" />
            {card.comments}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-6 gap-1">
          {[1, 0.92, 0.88, 0.8, 1, 0.7].map((v, i) => (
            <div key={i} className="h-0.5 rounded-full bg-border">
              <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${v * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
