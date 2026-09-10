"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SKILL_LEVEL_COPY, type SkillLevel } from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Graph = {
  languageSkills: { language: string; level: SkillLevel; confidence: number }[];
  overallTier: SkillLevel;
  summary: string;
  source: "ai" | "heuristic";
  computedAt: string;
  evidence: { repos: number; commits: number; mergedPrs: number };
};

const LEVEL_PCT: Record<SkillLevel, number> = { beginner: 38, intermediate: 68, advanced: 96 };
const LEVEL_TONE: Record<SkillLevel, string> = {
  beginner: "text-amber",
  intermediate: "text-neon",
  advanced: "text-iris",
};

/**
 * The computed skill profile. Owners can refresh it; a first visit with a
 * pending graph kicks the computation off in the background and polls.
 */
export function SkillGraphCard({
  initial,
  initialStatus,
  isOwner,
  selfReported,
}: {
  initial: Graph | null;
  initialStatus: string;
  isOwner: boolean;
  selfReported: SkillLevel | null;
}) {
  const [graph, setGraph] = useState<Graph | null>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  async function refresh(force: boolean) {
    setBusy(true);
    setStatus("computing");
    try {
      const res = await fetch(`/api/skillgraph${force ? "?force=true" : ""}`, { method: "POST" });
      const data = await res.json();
      if (res.status === 202) {
        // Already running elsewhere; poll for the result.
        await poll();
        return;
      }
      if (!res.ok || !data.ok) throw new Error(data.reason ?? data.error ?? "Could not compute");
      setGraph(data.skillGraph);
      setStatus("idle");
      if (force) toast.success("Skill profile refreshed");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Could not compute your skill profile");
    } finally {
      setBusy(false);
    }
  }

  async function poll() {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const data = await fetch("/api/skillgraph").then((r) => r.json());
      if (data.status !== "computing") {
        setGraph(data.skillGraph);
        setStatus(data.status);
        return;
      }
    }
    setStatus("idle");
  }

  // First visit with nothing computed yet: run it without the user having to
  // ask. Later views use the stored result; only a 30-day age or a manual
  // refresh recomputes.
  useEffect(() => {
    if (isOwner && !graph && (initialStatus === "pending" || initialStatus === "idle")) void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computing = status === "computing" || busy;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-iris">
            <Sparkles className="size-3" />
            skill graph
          </p>
          <h2 className="mt-1 font-mono text-sm font-medium">
            {graph ? "Computed from real activity" : "Not computed yet"}
          </h2>
        </div>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-[11px]"
            disabled={computing}
            onClick={() => refresh(true)}
          >
            {computing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            {computing ? "Reading GitHub…" : "Refresh"}
          </Button>
        )}
      </div>

      {computing && !graph && (
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Reading your public repos, commits and merged pull requests. This takes
          about half a minute and only runs on request or once a month.
        </p>
      )}

      {!computing && !graph && (
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          {status === "error"
            ? "The last attempt failed. Try refreshing."
            : selfReported
              ? `Using the self-reported level (${SKILL_LEVEL_COPY[selfReported].label}) until there is enough public activity to compute one.`
              : "No public activity found yet."}
        </p>
      )}

      {graph && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge className={cn("rounded-full font-mono text-[10px] font-normal", LEVEL_TONE[graph.overallTier])} variant="outline">
              {SKILL_LEVEL_COPY[graph.overallTier].label} overall
            </Badge>
            {selfReported && selfReported !== graph.overallTier && (
              <span className="font-mono text-[10px] text-muted-foreground">
                self-reported: {SKILL_LEVEL_COPY[selfReported].label}
              </span>
            )}
          </div>

          <p className="mt-3 text-pretty text-[13px] leading-relaxed text-foreground/85">{graph.summary}</p>

          {graph.languageSkills.length > 0 && (
            <ul className="mt-5 space-y-3">
              {graph.languageSkills.map((s) => (
                <li key={s.language}>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span>{s.language}</span>
                    <span className={cn(LEVEL_TONE[s.level])}>
                      {s.level}
                      <span className="ml-2 text-muted-foreground">·{Math.round(s.confidence * 100)}% conf</span>
                    </span>
                  </div>
                  <Progress value={LEVEL_PCT[s.level]} className="mt-1.5 h-1.5" />
                </li>
              ))}
            </ul>
          )}

          <p className="mt-5 font-mono text-[10px] leading-relaxed text-muted-foreground">
            Based on {graph.evidence.repos} repos, {graph.evidence.commits} commits and{" "}
            {graph.evidence.mergedPrs} merged PRs · {graph.source === "ai" ? "AI assessment" : "activity heuristic"} ·{" "}
            {relativeTime(graph.computedAt)}
          </p>
        </>
      )}
    </div>
  );
}
