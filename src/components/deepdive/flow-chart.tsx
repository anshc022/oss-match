"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleDot, FileCode2, Layers, RotateCcw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyIconButton, SPRING, useReduced } from "@/components/deepdive/motion-bits";
import type { ArchModule, IssueLocation } from "@/lib/deepdive/types";
import { cn } from "@/lib/utils";

/**
 * "Your path through this issue": Issue → module(s) → files → where to change.
 * The path draws in left to right and each isometric card springs in as the
 * line reaches it. Hover lights the segments touching a card; click expands
 * the reasoning for that step.
 */

type Step = {
  id: string;
  kind: "issue" | "module" | "file" | "change";
  title: string;
  subtitle: string;
  detail: string;
  copy?: string;
};

const CARD_W = 168;
const CARD_H = 72;
const GAP = 96;
const TOP = 60;

export function FlowChart({
  issueTitle,
  location,
  modules,
  repoUrl,
  defaultBranch,
}: {
  issueTitle: string;
  location: IssueLocation | null;
  modules: ArchModule[];
  repoUrl: string;
  defaultBranch: string;
}) {
  const reduced = useReduced();
  const [run, setRun] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const steps = useMemo<Step[]>(() => {
    const target = (location?.moduleIds ?? []).map((id) => modules.find((m) => m.id === id)).filter((m): m is ArchModule => Boolean(m));
    const files = Array.from(new Set([...(location?.mentionedPaths ?? []), ...target.flatMap((m) => m.filePaths)])).filter(Boolean).slice(0, 4);
    const out: Step[] = [
      { id: "issue", kind: "issue", title: "The issue", subtitle: issueTitle, detail: "What is being asked. Read it twice; note any file names, error messages or screens it mentions." },
    ];
    if (target.length) {
      out.push({
        id: "module",
        kind: "module",
        title: target.length === 1 ? target[0].name : `${target.length} modules`,
        subtitle: target.map((m) => m.name).join(" · "),
        detail: target.map((m) => `${m.name}: ${m.description}`).join("\n\n"),
      });
    }
    if (files.length) {
      out.push({
        id: "files",
        kind: "file",
        title: files.length === 1 ? "1 place to look" : `${files.length} places to look`,
        subtitle: files.map((f) => f.split("/").pop()).join(", "),
        detail: files.join("\n"),
        copy: files.join("\n"),
      });
    }
    out.push({
      id: "change",
      kind: "change",
      title: "Where to change",
      subtitle: location ? "the reasoning" : "start at the entry point",
      detail: location?.reasoning ?? "No mapping yet. Start from the module that handles what the issue describes and follow its imports.",
    });
    return out;
  }, [issueTitle, location, modules]);

  const width = steps.length * CARD_W + (steps.length - 1) * GAP + 80;
  const height = CARD_H + TOP + 70;
  const xOf = (i: number) => 40 + i * (CARD_W + GAP);
  const segDur = reduced ? 0 : 0.45;
  const stepDelay = (i: number) => (reduced ? 0 : i * (segDur + 0.15));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
        <span>hover a step to trace it · click to see why</span>
        <Button variant="outline" size="sm" className="h-7 font-mono text-[11px]" onClick={() => { setOpen(null); setRun((r) => r + 1); }}>
          <RotateCcw className="size-3" />
          replay
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/60">
        <svg key={run} viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" style={{ minWidth: Math.min(width, 900) }}>
          <defs>
            {(["iris", "cyan", "amber", "rose"] as const).map((c) => (
              <linearGradient key={c} id={`flow-${c}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={`hsl(var(--${c}))`} stopOpacity="0.32" />
                <stop offset="1" stopColor={`hsl(var(--${c}))`} stopOpacity="0.12" />
              </linearGradient>
            ))}
          </defs>

          {/* Paths between consecutive cards */}
          {steps.slice(0, -1).map((_, i) => {
            const x1 = xOf(i) + CARD_W, x2 = xOf(i + 1);
            const y = TOP + CARD_H / 2;
            const lit = hover === i || hover === i + 1;
            return (
              <g key={`p${i}`}>
                <motion.path
                  d={`M${x1},${y} C${x1 + GAP / 2},${y} ${x2 - GAP / 2},${y} ${x2},${y}`}
                  fill="none"
                  stroke={lit ? "hsl(var(--cyan))" : "hsl(var(--iris))"}
                  strokeWidth={lit ? 3 : 2}
                  strokeLinecap="round"
                  strokeDasharray="1"
                  initial={{ pathLength: reduced ? 1 : 0, opacity: lit ? 1 : 0.7 }}
                  animate={{ pathLength: 1, opacity: lit ? 1 : 0.7 }}
                  transition={{ pathLength: { duration: segDur, delay: stepDelay(i) + 0.2, ease: "easeInOut" }, opacity: { duration: 0.15 } }}
                />
                <motion.polygon
                  points={`${x2 - 8},${y - 5} ${x2},${y} ${x2 - 8},${y + 5}`}
                  fill={lit ? "hsl(var(--cyan))" : "hsl(var(--iris))"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: stepDelay(i) + 0.2 + segDur, duration: 0.15 }}
                />
              </g>
            );
          })}

          {steps.map((s, i) => (
            <FlowCard
              key={s.id}
              step={s}
              index={i}
              x={xOf(i)}
              y={TOP}
              delay={stepDelay(i)}
              reduced={reduced}
              hovered={hover === i}
              active={open === i}
              onHover={(h) => setHover(h ? i : null)}
              onClick={() => setOpen((o) => (o === i ? null : i))}
            />
          ))}
        </svg>
      </div>

      <AnimatePresence mode="wait">
        {open !== null && steps[open] && (
          <motion.div
            key={steps[open].id}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 8 }}
            transition={SPRING}
            className="rounded-xl border border-iris/30 bg-iris/5 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-iris">step {open + 1} · why</p>
                <h4 className="mt-1 font-mono text-sm font-medium">{steps[open].title}</h4>
              </div>
              {steps[open].copy && <CopyIconButton text={steps[open].copy!} label="Copy paths" />}
            </div>
            <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-foreground/85">
              {steps[open].detail.split("\n").filter(Boolean).map((line, k) =>
                steps[open].kind === "file" ? (
                  <a key={k} href={`${repoUrl}/blob/${defaultBranch}/${line}`} target="_blank" rel="noreferrer" className="block font-mono text-[12px] text-neon hover:underline">
                    {line}
                  </a>
                ) : (
                  <p key={k}>{line}</p>
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const KIND_META = {
  issue: { icon: CircleDot, tone: "iris" as const, label: "issue" },
  module: { icon: Layers, tone: "cyan" as const, label: "module" },
  file: { icon: FileCode2, tone: "amber" as const, label: "files" },
  change: { icon: Target, tone: "rose" as const, label: "change here" },
};

function FlowCard({
  step, index, x, y, delay, reduced, hovered, active, onHover, onClick,
}: {
  step: Step; index: number; x: number; y: number; delay: number; reduced: boolean;
  hovered: boolean; active: boolean; onHover: (h: boolean) => void; onClick: () => void;
}) {
  const meta = KIND_META[step.kind];
  const Icon = meta.icon;
  const d = 10; // isometric depth of the card
  const lift = hovered || active ? -6 : 0;
  return (
    <motion.g
      style={{ cursor: "pointer", transformOrigin: `${x + CARD_W / 2}px ${y + CARD_H / 2}px` }}
      initial={reduced ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, y: lift }}
      transition={{ ...SPRING, delay: reduced ? 0 : delay + 0.05 }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onClick={onClick}
      role="button"
      aria-label={`${meta.label}: ${step.title}`}
    >
      {/* Side faces give the card a slab feel matching the tree blocks. */}
      <polygon points={`${x},${y + CARD_H} ${x + CARD_W},${y + CARD_H} ${x + CARD_W - d},${y + CARD_H + d} ${x - d},${y + CARD_H + d}`} fill={`hsl(var(--${meta.tone}) / 0.28)`} />
      <polygon points={`${x + CARD_W},${y} ${x + CARD_W},${y + CARD_H} ${x + CARD_W - d},${y + CARD_H + d} ${x + CARD_W - d},${y + d}`} fill={`hsl(var(--${meta.tone}) / 0.18)`} />
      <rect x={x} y={y} width={CARD_W} height={CARD_H} rx={10} fill={`url(#flow-${meta.tone})`} stroke={`hsl(var(--${meta.tone}) / ${hovered || active ? 0.9 : 0.5})`} strokeWidth={hovered || active ? 1.5 : 1} />
      <foreignObject x={x} y={y} width={CARD_W} height={CARD_H}>
        <div className="flex h-full flex-col justify-center px-3.5 py-2">
          <p className={cn("flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em]", `text-${meta.tone === "cyan" ? "neon" : meta.tone}`)}>
            <Icon className="size-3" />
            {meta.label} · {index + 1}
          </p>
          <p className="mt-1 truncate font-mono text-[12px] font-semibold">{step.title}</p>
          <p className="truncate text-[10px] text-muted-foreground">{step.subtitle}</p>
        </div>
      </foreignObject>
    </motion.g>
  );
}
