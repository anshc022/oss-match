"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  ChevronDown,
  ExternalLink,
  GitFork,
  Loader2,
  MessageSquare,
  Star,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HacktoberfestBadge } from "@/components/issue-card";
import { looksHacktoberfest } from "@/lib/fetcher/queries";
import { factorTone } from "@/lib/factor-tones";
import { MentorLine } from "@/components/mentor-line";
import type { FeedIssue } from "@/lib/feed-types";
import { compactNumber, plainPreview, relativeTime, scoreTone } from "@/lib/format";
import { cn } from "@/lib/utils";


/**
 * A scannable row for list mode: the score, the title, the single strongest
 * reason, and the actions. The full breakdown and body sit behind a toggle so
 * a page of twenty-five rows stays a page and not a wall.
 */
export function IssueRow({
  issue,
  busy,
  onSave,
  onSkip,
}: {
  issue: FeedIssue;
  busy?: boolean;
  onSave: () => void;
  onSkip: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hacktoberfest = looksHacktoberfest(issue.labels);
  const preview = plainPreview(issue.body ?? "", 420);

  return (
    <li
      className={cn(
        "group rounded-xl border border-border/70 bg-card/80 transition-colors hover:border-iris/40",
        busy && "opacity-60",
      )}
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-4 p-4 sm:grid-cols-[auto_1fr_auto] sm:gap-x-5">
        {/* Score */}
        <div className="flex flex-col items-center justify-start pt-0.5">
          <span className={cn("font-mono text-2xl font-semibold tabular-nums leading-none", scoreTone(issue.matchScore))}>
            {Math.round(issue.matchScore * 100)}
          </span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">match</span>
        </div>

        {/* Body */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span className="truncate">{issue.repoFullName}</span>
            <span>#{issue.number}</span>
            {hacktoberfest && <HacktoberfestBadge />}
          </div>

          <h3 className="mt-1 line-clamp-2 text-pretty text-[15px] font-medium leading-snug">
            {issue.cacheId ? (
              <Link href={`/issue/${issue.cacheId}`} className="transition-colors hover:text-iris">
                {issue.title}
              </Link>
            ) : (
              issue.title
            )}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="size-3" />{compactNumber(issue.repo.stars)}</span>
            <span className="flex items-center gap-1"><GitFork className="size-3" />{compactNumber(issue.repo.forks)}</span>
            <span className="flex items-center gap-1"><MessageSquare className="size-3" />{issue.comments}</span>
            {issue.repo.language && <span className="text-iris">{issue.repo.language}</span>}
            <span>opened {relativeTime(issue.createdAt)}</span>
          </div>

          {issue.reasons[0] && (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-muted-foreground">
              <Zap className="mt-0.5 size-3 shrink-0 text-iris" />
              {issue.reasons[0]}
            </p>
          )}

          {issue.mentor && <MentorLine mentor={issue.mentor} className="mt-2.5 w-fit max-w-full" />}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {issue.labels.slice(0, 4).map((l) => (
              <Badge key={l} variant="secondary" className="rounded-full font-mono text-[10px] font-normal">
                {l}
              </Badge>
            ))}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="ml-auto flex items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {open ? "less" : "details"}
              <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="col-span-2 mt-3 flex items-center gap-2 sm:col-span-1 sm:mt-0 sm:flex-col sm:items-stretch">
          <Button
            size="sm"
            className="font-mono text-xs"
            disabled={busy}
            onClick={onSave}
            aria-label={`Save ${issue.title}`}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Bookmark className="size-3.5" />}
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs hover:border-destructive/50 hover:text-destructive"
            disabled={busy}
            onClick={onSkip}
            aria-label={`Skip ${issue.title}`}
          >
            <X className="size-3.5" />
            Skip
          </Button>
          <Button asChild variant="ghost" size="sm" className="ml-auto font-mono text-xs text-muted-foreground sm:ml-0">
            <a href={issue.htmlUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              GitHub
            </a>
          </Button>
        </div>
      </div>

      {open && (
        <div className="grid gap-5 border-t border-border/60 px-4 py-4 sm:grid-cols-[1fr_260px] sm:px-5">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {preview || "No description on this issue."}
          </p>
          <div className="space-y-2">
            {Object.entries(issue.breakdown).map(([key, value]) => {
              const tone = factorTone(key);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span>{tone.label}</span>
                    <span className="tabular-nums">{Math.round(value * 100)}</span>
                  </div>
                  <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-border">
                    <div className={cn("h-full rounded-full", tone.bg)} style={{ width: `${value * 100}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-x-3 pt-1 font-mono text-[10px] text-muted-foreground">
              {issue.repo.hasContributing && <span className="text-iris/80">CONTRIBUTING.md</span>}
              {issue.repo.hasCodeOfConduct && <span>code of conduct</span>}
              {issue.repo.hasCi && <span>CI</span>}
              <span>pushed {relativeTime(issue.repo.pushedAt)}</span>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
