"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, ExternalLink, Loader2, Network, Route, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp, CopyIconButton, SlidePanel, SPRING, useReduced } from "@/components/deepdive/motion-bits";
import { IsoTree } from "@/components/deepdive/iso-tree";
import { FlowChart } from "@/components/deepdive/flow-chart";
import { ArchGraph2D } from "@/components/deepdive/arch-graph-2d";
import { hasWebGL } from "@/components/deepdive/webgl";
import { STAGE_COPY, type ArchModule, type DeepDive, type DeepDiveStage, type IssueLocation } from "@/lib/deepdive/types";
import { cn } from "@/lib/utils";
import { Character } from "@/components/landing/story/voxel-figure";

const ArchGraph = dynamic(() => import("@/components/deepdive/arch-graph"), {
  ssr: false,
  loading: () => <Skeleton className="h-[440px] w-full rounded-xl sm:h-[520px]" />,
});

type Payload = {
  stage: DeepDiveStage;
  stageLabel: string;
  deepDive: DeepDive | null;
  location: IssueLocation | null;
  error: string;
  aiEnabled: boolean;
};

const TABS = [
  { id: "tree", label: "Repo tree", icon: Boxes },
  { id: "graph", label: "Architecture", icon: Network },
  { id: "flow", label: "Your path", icon: Route },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STAGES: DeepDiveStage[] = ["tree", "analyzing", "mapping"];

export function DeepDiveSheet({
  open, onOpenChange, origin, repo, repoUrl, defaultBranch, issueId, issueTitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  origin: { x: number; y: number } | null;
  repo: string;
  repoUrl: string;
  defaultBranch: string;
  issueId?: string;
  issueTitle: string;
}) {
  const reduced = useReduced();
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<TabId>("tree");
  const [selected, setSelected] = useState<string | null>(null);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => setWebgl(hasWebGL()), []);

  // Poll while generating. Stops on ready / error / unavailable.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const q = new URLSearchParams({ repo });
        if (issueId) q.set("issue", issueId);
        const res = await fetch(`/api/repos/deepdive?${q}`);
        if (!res.ok) return;
        const json = (await res.json()) as Payload;
        if (cancelled) return;
        setData(json);
        if (json.stage !== "ready" && json.stage !== "error" && json.stage !== "unavailable") timer = setTimeout(load, 2500);
      } catch {
        if (!cancelled) timer = setTimeout(load, 4000);
      }
    }
    void load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, repo, issueId]);

  const dd = data?.deepDive ?? null;
  const location = data?.location ?? null;
  const modules = useMemo<ArchModule[]>(() => dd?.architecture ?? [], [dd]);
  const highlightPaths = useMemo(() => {
    const ids = new Set(location?.moduleIds ?? []);
    return [...(location?.mentionedPaths ?? []), ...modules.filter((m) => ids.has(m.id)).flatMap((m) => m.filePaths)].filter(Boolean);
  }, [location, modules]);
  const selectedModule = modules.find((m) => m.id === selected) ?? null;

  const originStyle = origin
    ? { transformOrigin: `${origin.x}px ${origin.y}px` }
    : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-border/70 p-0 sm:max-w-[min(1100px,96vw)]"
        style={originStyle}
      >
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING}
          style={originStyle}
          className="min-h-full"
        >
          {/* ------------------------------------------------------ header */}
          <div className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-iris">
                  <Boxes className="size-3.5" />
                  repo deep dive
                </p>
                <SheetTitle className="mt-1 flex items-center gap-2 font-mono text-lg font-semibold tracking-tight">
                  <a href={repoUrl} target="_blank" rel="noreferrer" className="truncate hover:text-iris">{repo}</a>
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                </SheetTitle>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={() => onOpenChange(false)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>

            {dd && (
              <motion.div initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Stat n={dd.totalFiles} label="files" />
                <Stat n={modules.length} label="modules" />
                <Stat n={dd.connections.length} label="connections" />
                <div className="flex flex-wrap gap-1">
                  {dd.stack.slice(0, 6).map((s) => (
                    <Badge key={s} variant="outline" className="rounded-full border-border/60 font-mono text-[10px] font-normal text-muted-foreground">{s}</Badge>
                  ))}
                </div>
                <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  {dd.source === "ai" ? <><Sparkles className="size-3 text-iris" />AI-mapped</> : "mapped from folder names"}
                </span>
              </motion.div>
            )}
          </div>

          <div className="px-5 py-5 sm:px-8">
            {/* -------------------------------------------------- states */}
            {!data && <Loading stage="tree" />}
            {data && data.stage === "unavailable" && (
              <Note title="This repo can't be read" body="It is private, empty, or no longer exists on GitHub, so there is nothing to map." />
            )}
            {data && data.stage === "error" && !dd && (
              <Note title="Could not analyse this repo" body={data.error || "Something went wrong reading it."} />
            )}
            {data && STAGES.includes(data.stage) && !dd && <Loading stage={data.stage} />}

            {/* -------------------------------------------------- content */}
            {dd && (
              <div className="space-y-5">
                <p className="max-w-3xl text-pretty text-[14px] leading-relaxed text-foreground/85">{dd.stackSummary}</p>

                {data && STAGES.includes(data.stage) && (
                  <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> {STAGE_COPY[data.stage]}
                  </p>
                )}
                {dd.source === "heuristic" && (
                  <p className="rounded-lg border border-amber/30 bg-amber/5 px-3 py-2 text-[12px] text-muted-foreground">
                    The AI analysis was unavailable, so this map is built from folder names. Descriptions are approximate.
                  </p>
                )}

                {/* Tabs with a sliding indicator */}
                <div className="relative flex gap-1 rounded-full border border-border/60 bg-card/60 p-1" role="tablist">
                  {TABS.map((t) => {
                    const active = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => { setTab(t.id); setSelected(null); }}
                        className={cn("relative flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-3 font-mono text-[12px] transition-colors sm:min-h-9", active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                      >
                        {active && (
                          <motion.span layoutId="deepdive-tab" className="absolute inset-0 rounded-full bg-iris" transition={reduced ? { duration: 0 } : SPRING} />
                        )}
                        <t.icon className="relative size-3.5" />
                        <span className="relative">{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {tab === "tree" && (
                      <IsoTree tree={dd.fileTree} highlights={highlightPaths} repoUrl={repoUrl} defaultBranch={defaultBranch} truncated={dd.truncated} />
                    )}

                    {tab === "graph" && (
                      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                        {webgl ? (
                          <ArchGraph modules={modules} connections={dd.connections} highlightIds={location?.moduleIds ?? []} selectedId={selected} onSelect={setSelected} reduced={reduced} />
                        ) : (
                          <ArchGraph2D modules={modules} connections={dd.connections} highlightIds={location?.moduleIds ?? []} selectedId={selected} onSelect={setSelected} />
                        )}
                        <AnimatePresence mode="wait">
                          {selectedModule ? (
                            <SlidePanel key={selectedModule.id} className="rounded-xl border border-border/70 bg-card/80 p-4">
                              <ModulePanel m={selectedModule} repoUrl={repoUrl} defaultBranch={defaultBranch} highlighted={(location?.moduleIds ?? []).includes(selectedModule.id)} onClose={() => setSelected(null)} />
                            </SlidePanel>
                          ) : (
                            <SlidePanel key="legend" className="rounded-xl border border-dashed border-border/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-iris">how to read it</p>
                              <p className="mt-2">Top row is where a user or request enters. Bottom row is where data lives. Lines show which parts talk to each other.</p>
                              <p className="mt-2">Glowing modules are where your issue most likely lives. Click any module for its files.</p>
                              <ul className="mt-3 space-y-1 font-mono text-[10px]">
                                {[["iris", "what users see"], ["neon", "server logic"], ["amber", "config & tooling"], ["rose", "tests"]].map(([c, l]) => (
                                  <li key={c} className="flex items-center gap-2"><span className={`size-2 rounded-full bg-${c}`} />{l}</li>
                                ))}
                              </ul>
                            </SlidePanel>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {tab === "flow" && (
                      <FlowChart issueTitle={issueTitle} location={location} modules={modules} repoUrl={repoUrl} defaultBranch={defaultBranch} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <p className="font-mono text-[12px] text-muted-foreground">
      <CountUp value={n} className="text-base font-semibold text-foreground" /> {label}
    </p>
  );
}

function Loading({ stage }: { stage: DeepDiveStage }) {
  const idx = Math.max(0, STAGES.indexOf(stage));
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-5">
        <div className="hidden sm:block">
          <Character role="beret" unit={4} title="Deep Dive: maps the repository" />
        </div>
      <ol className="flex-1 space-y-2">
        {STAGES.map((s, i) => {
          const done = i < idx, now = i === idx;
          return (
            <li key={s} className={cn("flex items-center gap-3 font-mono text-[12px]", done ? "text-muted-foreground" : now ? "text-foreground" : "text-muted-foreground/60")}>
              <span className={cn("flex size-5 items-center justify-center rounded-full border", done ? "border-iris bg-iris text-primary-foreground" : now ? "border-iris" : "border-border")}>
                {done ? "✓" : now ? <Loader2 className="size-3 animate-spin text-iris" /> : i + 1}
              </span>
              {STAGE_COPY[s]}
            </li>
          );
        })}
      </ol>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-border">
        <motion.div className="absolute inset-y-0 w-1/3 rounded-full bg-iris" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        Reading the repo and asking the model can take a minute or two. This page stays usable meanwhile.
      </p>
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-6 text-center">
      <p className="font-mono text-sm font-medium">{title}</p>
      <p className="mt-2 text-[13px] text-muted-foreground">{body}</p>
    </div>
  );
}

function ModulePanel({ m, repoUrl, defaultBranch, highlighted, onClose }: { m: ArchModule; repoUrl: string; defaultBranch: string; highlighted: boolean; onClose: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{m.category} · layer {m.layer}</p>
          <h4 className="mt-0.5 font-mono text-sm font-semibold">{m.name}</h4>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close panel"><X className="size-3.5" /></Button>
      </div>
      {highlighted && <p className="rounded-md bg-neon/10 px-2 py-1 font-mono text-[10px] text-neon">your issue most likely lives here</p>}
      <p className="text-[13px] leading-relaxed text-foreground/85">{m.description}</p>
      {m.filePaths.length > 0 && (
        <ul className="space-y-1">
          {m.filePaths.map((p) => (
            <li key={p} className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1">
              <a href={`${repoUrl}/tree/${defaultBranch}/${p}`} target="_blank" rel="noreferrer" className="truncate font-mono text-[11px] hover:text-iris">{p || "/"}</a>
              <CopyIconButton text={p} className="size-6" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
