"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  CircleDot,
  GitFork,
  Leaf,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { FeedIssue } from "@/lib/feed-types";
import {
  compactNumber,
  plainPreview,
  relativeTime,
  scoreTone,
} from "@/lib/format";
import { looksHacktoberfest } from "@/lib/fetcher/queries";
import { factorTone } from "@/lib/factor-tones";
import { MentorLine } from "@/components/mentor-line";
import { cn } from "@/lib/utils";


export function IssueCard({
  issue,
  className,
}: {
  issue: FeedIssue;
  className?: string;
}) {
  const preview = plainPreview(issue.body ?? "");
  const hacktoberfest = looksHacktoberfest(issue.labels);
  const detailHref = issue.cacheId ? `/issue/${issue.cacheId}` : null;

  // A swipe that ends over the title must not also navigate. Track where the
  // pointer went down and cancel the click if it travelled.
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }
  function guardClick(e: React.MouseEvent) {
    const s = pointerStart.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) e.preventDefault();
  }

  return (
    <Card
      onPointerDown={onPointerDown}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden border-border/70 bg-card shadow-2xl shadow-black/40",
        className,
      )}
    >
      <CardHeader className="shrink-0 gap-3 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-mono text-xs text-muted-foreground">
                {issue.repoFullName}
              </p>
              {hacktoberfest && <HacktoberfestBadge />}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="size-3" />
                {compactNumber(issue.repo.stars)}
              </span>
              <span className="flex items-center gap-1">
                <GitFork className="size-3" />
                {compactNumber(issue.repo.forks)}
              </span>
              {issue.repo.language && (
                <span className="text-primary">{issue.repo.language}</span>
              )}
              <span>pushed {relativeTime(issue.repo.pushedAt)}</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div
              className={cn(
                "font-mono text-2xl font-semibold tabular-nums",
                scoreTone(issue.matchScore),
              )}
            >
              {Math.round(issue.matchScore * 100)}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              match
            </div>
          </div>
        </div>

        <h2 className="text-pretty text-lg font-medium leading-snug">
          {detailHref ? (
            <Link
              href={detailHref}
              onClick={guardClick}
              draggable={false}
              className="transition-colors hover:text-iris"
            >
              {issue.title}
            </Link>
          ) : (
            issue.title
          )}
        </h2>

        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <CircleDot className="size-3 text-primary" />
          <span>#{issue.number}</span>
          <span>·</span>
          <span>opened {relativeTime(issue.createdAt)}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            {issue.comments}
          </span>
        </div>
      </CardHeader>

      {/* min-h-0 + overflow-hidden lets this region shrink when the card is
          full, so the footer with the breakdown is never the part that is cut. */}
      <CardContent className="min-h-0 flex-1 space-y-3 overflow-hidden pb-4">
        {issue.mentor && <MentorLine mentor={issue.mentor} bold />}
        {preview && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {preview}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {issue.labels.slice(0, 5).map((label) => (
            <Badge
              key={label}
              variant="secondary"
              className="rounded-full font-mono text-[10px] font-normal"
            >
              {label}
            </Badge>
          ))}
        </div>

        {issue.reasons.length > 0 && (
          <>
            <Separator className="bg-border/60" />
            <ul className="space-y-1.5">
              {issue.reasons.slice(0, 3).map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <Zap className="mt-0.5 size-3 shrink-0 text-primary" />
                  {reason}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>

      <CardFooter className="shrink-0 flex-col items-stretch gap-3 border-t border-border/60 bg-secondary/20 pt-4">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          {Object.entries(issue.breakdown).map(([key, value]) => {
            const tone = factorTone(key);
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{tone.label}</span>
                  <span className="tabular-nums">{Math.round(value * 100)}</span>
                </div>
                <div className="h-0.5 overflow-hidden rounded-full bg-border">
                  <div className={cn("h-full rounded-full", tone.bg)} style={{ width: `${value * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
          {issue.repo.hasContributing && (
            <span className="flex items-center gap-1 text-primary/80">
              <ScrollText className="size-3" />
              CONTRIBUTING.md
            </span>
          )}
          {issue.repo.hasCodeOfConduct && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3" />
              code of conduct
            </span>
          )}
          {issue.repo.hasCi && <span>CI</span>}
          {detailHref && (
            <Link
              href={detailHref}
              onClick={guardClick}
              draggable={false}
              className="ml-auto text-iris transition-colors hover:underline"
            >
              details →
            </Link>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

/** Marks an issue carrying a hacktoberfest label. */
export function HacktoberfestBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 gap-1 rounded-full border-orange-500/40 bg-orange-500/10 px-1.5 font-mono text-[10px] font-normal text-orange-400",
        className,
      )}
    >
      <Leaf className="size-2.5" />
      hacktoberfest
    </Badge>
  );
}
