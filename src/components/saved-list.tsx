"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, ExternalLink, ListChecks, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/page-header";
import { GUIDE_STEPS } from "@/lib/guide";
import { relativeTime, scoreTone } from "@/lib/format";
import { ISSUE_STATUSES, type IssueStatus } from "@/lib/constants";
import type { SavedIssueRecord } from "@/lib/feed-types";
import { cn } from "@/lib/utils";

const FILTERS = ["all", ...ISSUE_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_COPY: Record<Filter, { label: string; hint: string; tone: "default" | "iris" | "neon" | "amber" }> = {
  all: { label: "all", hint: "everything you kept", tone: "default" },
  saved: { label: "saved", hint: "not started yet", tone: "iris" },
  "in-progress": { label: "in progress", hint: "guide underway", tone: "neon" },
  contributed: { label: "contributed", hint: "on your profile", tone: "amber" },
};

export function SavedList({ issues: initial }: { issues: SavedIssueRecord[] }) {
  const [issues, setIssues] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: issues.length, saved: 0, "in-progress": 0, contributed: 0 };
    for (const i of issues) base[i.status] += 1;
    return base;
  }, [issues]);

  const visible = useMemo(
    () => (filter === "all" ? issues : issues.filter((i) => i.status === filter)),
    [issues, filter],
  );

  async function setStatus(id: string, status: IssueStatus) {
    const previous = issues;
    setIssues((prev) => prev.map((i) => (i._id === id ? { ...i, status } : i)));
    try {
      const res = await fetch("/api/issues/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      if (status === "contributed") toast.success("Added to your profile");
    } catch {
      setIssues(previous);
      toast.error("Could not update that issue");
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary doubles as the filter. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <StatTile
            key={f}
            n={counts[f]}
            label={FILTER_COPY[f].label}
            hint={FILTER_COPY[f].hint}
            tone={FILTER_COPY[f].tone}
            active={filter === f}
            onClick={() => setFilter(f)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-6 py-12 text-center">
          <p className="font-mono text-sm text-muted-foreground">Nothing with that status yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((issue) => (
            <SavedRow key={issue._id} issue={issue} onStatus={setStatus} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SavedRow({
  issue,
  onStatus,
}: {
  issue: SavedIssueRecord;
  onStatus: (id: string, status: IssueStatus) => void;
}) {
  const total = issue.totalSteps ?? GUIDE_STEPS.length;
  const done = new Set(issue.guideProgress ?? []);
  const nextStep = GUIDE_STEPS.find((s) => !done.has(s.id));
  const complete = done.size === total;

  return (
    <li className="group rounded-xl border border-border/70 bg-card/80 p-5 transition-colors hover:border-iris/40">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
            <span className="truncate">{issue.repoName}</span>
            <span>#{issue.issueNumber}</span>
            <span>·</span>
            <span>saved {relativeTime(issue.savedAt)}</span>
          </p>
          <Link
            href={`/guide/${issue._id}`}
            className="mt-1 block text-pretty text-[15px] font-medium leading-snug transition-colors hover:text-iris"
          >
            {issue.issueTitle}
          </Link>
        </div>
        <div className="shrink-0 text-right">
          <div className={cn("font-mono text-xl font-semibold tabular-nums leading-none", scoreTone(issue.matchScore))}>
            {Math.round(issue.matchScore * 100)}
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">match</div>
        </div>
      </div>

      {/* Eight dots, one per guide step. */}
      <div className="mt-4 flex items-center gap-3">
        <ol className="flex items-center gap-1" aria-label={`${done.size} of ${total} steps done`}>
          {GUIDE_STEPS.map((s) => (
            <li
              key={s.id}
              title={s.title}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                done.has(s.id) ? "bg-iris" : "bg-border",
              )}
            />
          ))}
        </ol>
        <span className="font-mono text-[11px] text-muted-foreground">
          {complete ? "all steps done" : nextStep ? `next: ${nextStep.title.toLowerCase()}` : `${done.size}/${total}`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant={issue.status === "contributed" ? "default" : "secondary"}
            className="rounded-full font-mono text-[10px] font-normal"
          >
            {issue.status === "contributed" && <Trophy className="mr-1 size-2.5" />}
            {issue.status}
          </Badge>
          {issue.language && (
            <Badge variant="outline" className="rounded-full border-border/60 font-mono text-[10px] font-normal text-muted-foreground">
              {issue.language}
            </Badge>
          )}
          {issue.labels.slice(0, 2).map((l) => (
            <Badge key={l} variant="outline" className="rounded-full border-border/60 font-mono text-[10px] font-normal text-muted-foreground">
              {l}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {issue.status !== "contributed" && complete && (
            <Button
              variant="outline"
              size="sm"
              className="border-amber/40 font-mono text-[11px] text-amber hover:bg-amber/10"
              onClick={() => onStatus(issue._id, "contributed")}
            >
              <Trophy className="size-3" />
              Mark contributed
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="font-mono text-[11px] text-muted-foreground">
            <a href={issue.issueUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" />
              GitHub
            </a>
          </Button>
          <Button asChild size="sm" className="font-mono text-[11px]">
            <Link href={`/guide/${issue._id}`}>
              <ListChecks className="size-3" />
              {done.size === 0 ? "Start guide" : complete ? "Review" : "Continue"}
            </Link>
          </Button>
        </div>
      </div>
    </li>
  );
}

export function SavedEmpty() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-10 text-center sm:p-14">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-iris/15 blur-3xl" />
      <div className="relative mx-auto flex size-12 items-center justify-center rounded-full border border-iris/30 bg-iris/10">
        <Bookmark className="size-5 text-iris" />
      </div>
      <h2 className="relative mt-5 font-mono text-lg font-medium">Nothing saved yet</h2>
      <p className="relative mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        Save an issue from your feed and it lands here with an eight-step guide
        filled in for that exact repo: fork, clone, branch, commit, PR.
      </p>
      <div className="relative mt-6">
        <Button asChild className="font-mono">
          <Link href="/feed">Open the feed</Link>
        </Button>
      </div>
    </div>
  );
}
