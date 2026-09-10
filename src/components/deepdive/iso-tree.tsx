"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ExternalLink, Folder, FolderOpen, FileText } from "lucide-react";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { CopyIconButton, SPRING, useRafThrottle, useReduced } from "@/components/deepdive/motion-bits";
import { ancestorsOf, bounds, isHighlighted, layoutIso, project, TILE_H, TILE_W, type IsoNode } from "@/lib/deepdive/iso-layout";
import type { TreeNode } from "@/lib/deepdive/types";
import { cn } from "@/lib/utils";

/**
 * The file tree as an isometric city. Folders are extruded blocks that gain
 * height with nesting; clicking one raises its children behind it and shifts
 * siblings aside with a spring. Blocks the issue touches glow and float.
 */
export function IsoTree({
  tree,
  highlights,
  repoUrl,
  defaultBranch,
  truncated,
}: {
  tree: TreeNode;
  highlights: string[];
  repoUrl: string;
  defaultBranch: string;
  truncated: boolean;
}) {
  const reduced = useReduced();
  const [expanded, setExpanded] = useState<Set<string>>(() => ancestorsOf(highlights));
  const [hover, setHover] = useState<IsoNode | null>(null);
  const [menu, setMenu] = useState<{ node: IsoNode; x: number; y: number } | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>();

  const nodes = useMemo(() => layoutIso(tree, expanded), [tree, expanded]);
  const b = useMemo(() => bounds(nodes), [nodes]);
  const grid = useMemo(() => {
    let cols = 0, rows = 0;
    for (const n of nodes) { cols = Math.max(cols, n.col + n.span); rows = Math.max(rows, n.row); }
    return { cols: cols + 1, rows: rows + 1 };
  }, [nodes]);
  const PAD = 70;
  const vb = {
    x: b.minX - TILE_W / 2 - PAD,
    y: b.minY - 60 - PAD,
    w: b.maxX - b.minX + TILE_W + PAD * 2,
    h: b.maxY - b.minY + TILE_H + 60 + PAD * 2,
  };

  useEffect(() => {
    setExpanded(ancestorsOf(highlights));
  }, [highlights, tree]);

  const onMove = useRafThrottle((e: React.PointerEvent) => {
    if (reduced || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: py * -5, ry: px * 6 });
  });

  function toggle(n: IsoNode) {
    if (!n.hasChildren) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(n.node.path)) next.delete(n.node.path); else next.add(n.node.path);
      return next;
    });
  }

  const toScreen = (n: IsoNode) => {
    const { x, y } = project(n);
    return { left: `${((x - vb.x) / vb.w) * 100}%`, top: `${((y - vb.y) / vb.h) * 100}%` };
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
        <span>click a folder to open it · right-click or hold for options · {truncated ? "large repo, shown to two levels" : "hover for details"}</span>
        <button
          type="button"
          className="rounded-md border border-border/70 px-2 py-1 hover:border-iris/50 hover:text-foreground"
          onClick={() => setExpanded(new Set())}
        >
          collapse all
        </button>
      </div>

      <div
        ref={wrap}
        className="relative overflow-auto rounded-xl border border-border/70 bg-card/60 [perspective:1200px]"
        onPointerMove={onMove}
        onPointerLeave={() => setTilt({ rx: 0, ry: 0 })}
      >
        <motion.svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="block h-auto min-h-[380px] w-full min-w-[640px]"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateX: tilt.rx, rotateY: tilt.ry }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        >
          <defs>
            {(["dir", "file", "highlight"] as const).map((k) => (
              <IsoGradients key={k} id={k} color={k === "highlight" ? "var(--cyan)" : k === "dir" ? "var(--iris)" : "var(--muted-foreground)"} />
            ))}
            <filter id="iso-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Floor grid, sized to whatever the layout currently spans. */}
          <g stroke="hsl(var(--border) / 0.5)" strokeWidth="1" fill="none">
            {Array.from({ length: grid.rows + 1 }, (_, r) => (
              <line
                key={`r${r}`}
                x1={(0 - r) * (TILE_W / 2)}
                y1={(0 + r) * (TILE_H / 2) + 40}
                x2={(grid.cols - r) * (TILE_W / 2)}
                y2={(grid.cols + r) * (TILE_H / 2) + 40}
              />
            ))}
            {Array.from({ length: grid.cols + 1 }, (_, c) => (
              <line
                key={`c${c}`}
                x1={c * (TILE_W / 2)}
                y1={c * (TILE_H / 2) + 40}
                x2={(c - grid.rows) * (TILE_W / 2)}
                y2={(c + grid.rows) * (TILE_H / 2) + 40}
              />
            ))}
          </g>

          <AnimatePresence initial={!reduced}>
            {nodes.map((n, i) => (
              <IsoBlock
                key={n.key}
                n={n}
                index={i}
                reduced={reduced}
                highlighted={isHighlighted(n.node.path, highlights)}
                hovered={hover?.key === n.key}
                onHover={setHover}
                onToggle={toggle}
                onMenu={(node, x, y) => setMenu({ node, x, y })}
                pressTimer={pressTimer}
              />
            ))}
          </AnimatePresence>

          {/* Labels last so nothing paints over a name. */}
          <AnimatePresence initial={!reduced}>
            {nodes.map((n) => (
              <IsoLabel
                key={`l-${n.key}`}
                n={n}
                reduced={reduced}
                highlighted={isHighlighted(n.node.path, highlights)}
                hovered={hover?.key === n.key}
              />
            ))}
          </AnimatePresence>
        </motion.svg>

        {/* Tooltip, positioned in the SVG's coordinate space. */}
        <AnimatePresence>
          {hover && !menu && (
            <motion.div
              key={hover.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-lg"
              style={toScreen(hover)}
            >
              <p className="flex items-center gap-1.5 font-mono text-[11px]">
                {hover.isDir ? (hover.expanded ? <FolderOpen className="size-3 text-iris" /> : <Folder className="size-3 text-iris" />) : <FileText className="size-3 text-muted-foreground" />}
                {hover.node.name}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {hover.isDir ? `${hover.node.fileCount} file${hover.node.fileCount === 1 ? "" : "s"}` : hover.node.path}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context menu on right-click / long-press. */}
        <Popover open={Boolean(menu)} onOpenChange={(o) => !o && setMenu(null)}>
          <PopoverPrimitive.Anchor asChild>
            <span className="absolute size-px" style={menu ? { left: menu.x, top: menu.y } : { left: -9999, top: -9999 }} />
          </PopoverPrimitive.Anchor>
          <PopoverContent side="top" align="center" className="w-56 p-2">
            {menu && (
              <div className="space-y-1">
                <p className="truncate px-2 py-1 font-mono text-[11px] text-muted-foreground">{menu.node.node.path}</p>
                <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                  <span>Copy path</span>
                  <CopyIconButton text={menu.node.node.path} />
                </div>
                <a
                  href={`${repoUrl}/${menu.node.isDir ? "tree" : "blob"}/${defaultBranch}/${menu.node.node.path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  Open on GitHub
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function IsoGradients({ id, color }: { id: string; color: string }) {
  // Lighter top, mid left, darker right: the light comes from the top-left.
  return (
    <>
      <linearGradient id={`iso-${id}-top`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={`hsl(${color})`} stopOpacity="0.95" />
        <stop offset="1" stopColor={`hsl(${color})`} stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id={`iso-${id}-left`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`hsl(${color})`} stopOpacity="0.62" />
        <stop offset="1" stopColor={`hsl(${color})`} stopOpacity="0.42" />
      </linearGradient>
      <linearGradient id={`iso-${id}-right`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`hsl(${color})`} stopOpacity="0.45" />
        <stop offset="1" stopColor={`hsl(${color})`} stopOpacity="0.28" />
      </linearGradient>
    </>
  );
}

function IsoBlock({
  n, index, reduced, highlighted, hovered, onHover, onToggle, onMenu, pressTimer,
}: {
  n: IsoNode;
  index: number;
  reduced: boolean;
  highlighted: boolean;
  hovered: boolean;
  onHover: (n: IsoNode | null) => void;
  onToggle: (n: IsoNode) => void;
  onMenu: (n: IsoNode, x: number, y: number) => void;
  pressTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
}) {
  const { x, y } = project(n);
  const w = TILE_W - 10;
  const h = TILE_H - 5;
  const height = n.isDir ? 14 + Math.min(n.depth, 3) * 4 : 6;
  const g = highlighted ? "highlight" : n.isDir ? "dir" : "file";
  const lift = hovered ? -6 : 0;

  // Top diamond centred at (0,0); side faces drop by `height`.
  const top = `0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`;
  const left = `${-w / 2},0 0,${h / 2} 0,${h / 2 + height} ${-w / 2},${height}`;
  const right = `${w / 2},0 0,${h / 2} 0,${h / 2 + height} ${w / 2},${height}`;

  const float = highlighted && !reduced ? { y: [y + lift, y + lift - 4, y + lift] } : { y: y + lift };

  return (
    <motion.g
      style={{ cursor: n.hasChildren ? "pointer" : "default" }}
      initial={reduced ? { x, y, opacity: 1 } : { x, y: y + 28, opacity: 0 }}
      animate={{ x, ...float, opacity: 1 }}
      exit={reduced ? undefined : { opacity: 0, y: y + 20 }}
      transition={
        highlighted && !reduced
          ? { x: SPRING, opacity: SPRING, y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } }
          : { ...SPRING, delay: reduced ? 0 : Math.min(index * 0.018, 0.5) }
      }
      onPointerEnter={() => onHover(n)}
      onPointerLeave={() => { onHover(null); clearTimeout(pressTimer.current); }}
      onClick={() => onToggle(n)}
      onContextMenu={(e) => { e.preventDefault(); const r = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement)?.getBoundingClientRect(); onMenu(n, e.clientX - (r?.left ?? 0), e.clientY - (r?.top ?? 0)); }}
      onPointerDown={(e) => {
        const target = e.currentTarget.ownerSVGElement?.parentElement as HTMLElement | undefined;
        const r = target?.getBoundingClientRect();
        const cx = e.clientX - (r?.left ?? 0), cy = e.clientY - (r?.top ?? 0);
        clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => onMenu(n, cx, cy), 520);
      }}
      onPointerUp={() => clearTimeout(pressTimer.current)}
      role="button"
      aria-label={`${n.node.name}${n.isDir ? `, folder with ${n.node.fileCount} files` : ""}`}
    >
      {highlighted && (
        <motion.polygon
          points={top}
          fill="hsl(var(--cyan))"
          filter="url(#iso-glow)"
          animate={reduced ? { opacity: 0.5 } : { opacity: [0.35, 0.75, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <polygon points={left} fill={`url(#iso-${g}-left)`} />
      <polygon points={right} fill={`url(#iso-${g}-right)`} />
      <polygon
        points={top}
        fill={`url(#iso-${g}-top)`}
        stroke={hovered ? "hsl(var(--foreground) / 0.6)" : "hsl(var(--background) / 0.6)"}
        strokeWidth={hovered ? 1.5 : 0.75}
        className={cn(hovered && "brightness-125")}
      />
    </motion.g>
  );
}

/**
 * Names live in their own layer above every block, so a block drawn later can
 * never paint over a label. Folders are always named; files would collide at
 * this density, so they surface on hover or when they are part of your path.
 */
function IsoLabel({ n, reduced, highlighted, hovered }: { n: IsoNode; reduced: boolean; highlighted: boolean; hovered: boolean }) {
  if (!n.isDir && !highlighted && !hovered) return null;
  const { x, y } = project(n);
  const h = TILE_H - 5;
  const height = n.isDir ? 14 + Math.min(n.depth, 3) * 4 : 6;
  return (
    <motion.text
      initial={reduced ? { opacity: 1 } : { opacity: 0 }}
      animate={{ x, y: y + height + h / 2 + 11 + (hovered ? -6 : 0), opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      textAnchor="middle"
      className={cn("pointer-events-none select-none font-mono", highlighted ? "fill-neon" : "fill-foreground")}
      style={{
        fontSize: n.isDir ? 9.5 : 8.5,
        // A background-coloured outline keeps a name readable where two labels
        // land on top of each other.
        paintOrder: "stroke",
        stroke: "hsl(var(--background))",
        strokeWidth: 3,
        strokeLinejoin: "round",
      }}
    >
      {truncate(n.node.name, n.isDir ? 14 : 16)}
      {n.isDir && n.hasChildren ? (n.expanded ? " −" : ` +${n.node.children?.length ?? 0}`) : ""}
    </motion.text>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
