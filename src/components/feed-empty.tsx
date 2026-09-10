"use client";

import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Loading, error and empty states shared by the deck and the list view. */

export function FeedSkeleton({ compact = false }: { compact?: boolean }) {
  const cards = compact ? [0, 1] : [0];
  return (
    <div className={cn("flex flex-col items-center gap-6", compact && "w-full")}>
      <div className={cn("w-full", compact ? "grid gap-4 lg:grid-cols-2" : "max-w-lg")}>
        {cards.map((i) => (
          <Card key={i} className={cn("border-border/70 bg-card", compact ? "h-[420px]" : "h-[640px] w-full sm:h-[680px]")}>
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-3/4" />
              <div className="space-y-2 pt-4">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="flex gap-2 pt-4">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        scoring issues against your profile
      </p>
    </div>
  );
}

export function FeedError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      title="Feed unavailable"
      body={message}
      action={
        <Button onClick={onRetry} className="font-mono" size="sm">
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      }
    />
  );
}

export function FeedExhausted({
  filtered,
  nothingAtAll,
  onRefresh,
  onClearFilter,
}: {
  /** The Hacktoberfest filter is on and produced nothing. */
  filtered: boolean;
  /** The cache had nothing for this user's languages at all. */
  nothingAtAll: boolean;
  onRefresh: () => void;
  onClearFilter: () => void;
}) {
  const title = filtered
    ? "No Hacktoberfest issues yet"
    : nothingAtAll
      ? "Nothing matched yet"
      : "That's everything";
  const body = filtered
    ? "Nothing in the cache carries a hacktoberfest label for your languages right now. Clear the filter to see everything else."
    : nothingAtAll
      ? "No issues are cached for your languages yet. The background fetcher indexes new ones on a schedule, so this fills in shortly after it next runs."
      : "You have been through every issue in the cache for your filters. The background fetcher adds more on its next cycle.";

  return (
    <EmptyState
      title={title}
      body={body}
      action={
        <div className="flex gap-2">
          {filtered ? (
            <Button onClick={onClearFilter} className="font-mono" size="sm">
              Clear filter
            </Button>
          ) : (
            <Button onClick={onRefresh} className="font-mono" size="sm">
              <RefreshCw className="size-3.5" />
              Refresh feed
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="font-mono">
            <Link href="/saved">Go to my list</Link>
          </Button>
        </div>
      }
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="mx-auto w-full max-w-lg border-border/70 bg-card/80">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <h2 className="font-mono text-lg font-medium">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        {action}
      </CardContent>
    </Card>
  );
}
