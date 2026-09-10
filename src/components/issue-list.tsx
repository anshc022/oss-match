"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IssueRow } from "@/components/issue-row";
import { FeedError, FeedExhausted, FeedSkeleton } from "@/components/feed-empty";
import type { IssueFeed } from "@/hooks/use-issue-feed";
import type { FeedIssue } from "@/lib/feed-types";

/**
 * The ordinary view: a dense, scannable list with explicit Save and Skip
 * buttons, for people who would rather read a page than swipe a card.
 */
export function IssueList({ feed }: { feed: IssueFeed }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function act(issue: FeedIssue, action: "save" | "skip") {
    setBusy(issue.htmlUrl);
    const ok = await feed.persist(issue, action);
    setBusy(null);
    if (!ok) return;
    feed.remove(issue.htmlUrl);
    if (action === "save") {
      toast.success("Saved to your list", {
        action: { label: "Open guide", onClick: () => (window.location.href = "/saved") },
      });
    }
  }

  if (feed.issues === null) return <FeedSkeleton compact />;

  if (feed.error && feed.issues.length === 0) {
    return <FeedError message={feed.error} onRetry={feed.load} />;
  }

  if (feed.issues.length === 0) {
    return (
      <FeedExhausted
        filtered={feed.hacktoberfestOnly}
        nothingAtAll={!feed.hasMore}
        onRefresh={feed.load}
        onClearFilter={() => feed.setHacktoberfestOnly(false)}
      />
    );
  }

  return (
    <div className="w-full">
      <ul className="space-y-3">
        {feed.issues.map((issue) => (
          <IssueRow
            key={issue.htmlUrl}
            issue={issue}
            busy={busy === issue.htmlUrl}
            onSave={() => act(issue, "save")}
            onSkip={() => act(issue, "skip")}
          />
        ))}
      </ul>

      <div className="mt-8 flex items-center justify-center gap-4 font-mono text-[11px] text-muted-foreground">
        <span>
          {feed.issues.length} shown{feed.hasMore ? "+" : ""}
        </span>
        {feed.hasMore && (
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            disabled={feed.loadingMore}
            onClick={feed.loadMore}
          >
            {feed.loadingMore && <Loader2 className="size-3.5 animate-spin" />}
            Load more
          </Button>
        )}
      </div>
    </div>
  );
}
