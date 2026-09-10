"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SPRING, useReduced } from "@/components/deepdive/motion-bits";
import type { ArchModule, Connection } from "@/lib/deepdive/types";
import { cn } from "@/lib/utils";

/** Layered SVG graph used when WebGL is unavailable. Same interactions, flat. */
export function ArchGraph2D({
  modules,
  connections,
  highlightIds,
  selectedId,
  onSelect,
}: {
  modules: ArchModule[];
  connections: Connection[];
  highlightIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const reduced = useReduced();
  const [hover, setHover] = useState<string | null>(null);
  const W = 880, ROW = 140, NODE_W = 150, NODE_H = 44;

  const placed = useMemo(() => {
    const rows = [0, 1, 2].map((l) => modules.filter((m) => m.layer === l));
    const out = new Map<string, { m: ArchModule; x: number; y: number }>();
    rows.forEach((row, l) => {
      const gap = (W - row.length * NODE_W) / (row.length + 1);
      row.forEach((m, i) => out.set(m.id, { m, x: gap + i * (NODE_W + gap), y: 40 + l * ROW }));
    });
    return out;
  }, [modules]);

  const tone = (c: string) => ({ frontend: "iris", backend: "cyan", config: "amber", tests: "rose", docs: "muted-foreground" }[c] ?? "iris");
  const lit = (e: Connection) => !hover || e.from === hover || e.to === hover;

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/60">
      <svg viewBox={`0 0 ${W} ${40 + 3 * ROW}`} className="block h-auto w-full" style={{ minWidth: 640 }}>
        {[0, 1, 2].map((l) => (
          <text key={l} x={12} y={40 + l * ROW + NODE_H / 2 + 4} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            {["entry", "logic", "data"][l]}
          </text>
        ))}
        {connections.map((c, i) => {
          const a = placed.get(c.from), b = placed.get(c.to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
          const on = lit(c);
          return (
            <motion.path
              key={i}
              d={`M${x1},${y1} C${x1},${y1 + 50} ${x2},${y2 - 50} ${x2},${y2}`}
              fill="none"
              stroke={on ? "hsl(var(--iris))" : "hsl(var(--border))"}
              strokeWidth={on && hover ? 2.5 : 1.5}
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1, opacity: hover && !on ? 0.2 : 0.8 }}
              transition={{ pathLength: { duration: 0.6, delay: reduced ? 0 : i * 0.04 }, opacity: { duration: 0.15 } }}
            />
          );
        })}
        {Array.from(placed.values()).map(({ m, x, y }, i) => {
          const hi = highlightIds.includes(m.id);
          const t = tone(m.category);
          const active = hover === m.id || selectedId === m.id;
          return (
            <motion.g
              key={m.id}
              style={{ cursor: "pointer" }}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: hover && !active && !connections.some((c) => (c.from === hover && c.to === m.id) || (c.to === hover && c.from === m.id)) ? 0.35 : 1, y: active ? -3 : 0 }}
              transition={{ ...SPRING, delay: reduced ? 0 : i * 0.03 }}
              onPointerEnter={() => setHover(m.id)}
              onPointerLeave={() => setHover(null)}
              onClick={() => onSelect(selectedId === m.id ? null : m.id)}
            >
              <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={10} fill={`hsl(var(--${t}) / ${hi ? 0.28 : 0.14})`} stroke={hi ? "hsl(var(--cyan))" : `hsl(var(--${t}) / ${active ? 0.9 : 0.5})`} strokeWidth={active || hi ? 1.8 : 1} />
              <text x={x + NODE_W / 2} y={y + NODE_H / 2 + 4} textAnchor="middle" className={cn("font-mono", hi ? "fill-neon" : "fill-foreground")} style={{ fontSize: 11 }}>
                {m.name.length > 20 ? `${m.name.slice(0, 19)}…` : m.name}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
