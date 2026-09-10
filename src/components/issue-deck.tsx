"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TinderCard from "react-tinder-card";
import { Bookmark, ExternalLink, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IssueCard } from "@/components/issue-card";
import { FeedError, FeedExhausted, FeedSkeleton } from "@/components/feed-empty";
import type { IssueFeed } from "@/hooks/use-issue-feed";
import type { FeedIssue } from "@/lib/feed-types";

/** Cards remaining when the next page is requested. */
const PREFETCH_AT = 8;

type Direction = "left" | "right" | "up" | "down";
type CardApi = { swipe: (dir?: Direction) => Promise<void>; restoreCard: () => Promise<void> };

/**
 * The swipe view. Owns only what swiping needs: a cursor into the shared
 * array (so undo can step back), card refs, and keyboard parity.
 */
export function IssueDeck({ feed }: { feed: IssueFeed }) {
  const { issues, hasMore, loadMore, persist, generation } = feed;
  const [index, setIndex] = useState(0);
  const [lastAction, setLastAction] = useState<{ issue: FeedIssue; action: "save" | "skip" } | null>(null);

  // Refs are keyed by issue URL so a re-render never rebinds the wrong card.
  const cardRefs = useRef(new Map<string, CardApi | null>());
  // Guards against the double-fire that react-tinder-card emits on fast swipes.
  const handled = useRef(new Set<string>());

  // A fresh load (filter change, retry) restarts the deck from the top.
  useEffect(() => {
    setIndex(0);
    setLastAction(null);
    handled.current.clear();
  }, [generation]);

  // Fetch the next page a few cards before the end, so swiping never stalls.
  useEffect(() => {
    if (!issues) return;
    if (issues.length - index <= PREFETCH_AT && hasMore) void loadMore();
  }, [issues, index, hasMore, loadMore]);

  const onSwipe = useCallback(
    (issue: FeedIssue, direction: Direction) => {
      if (handled.current.has(issue.htmlUrl)) return;
      handled.current.add(issue.htmlUrl);

      const action = direction === "right" ? "save" : "skip";
      setIndex((i) => i + 1);
      setLastAction({ issue, action });
      void persist(issue, action);

      if (action === "save") {
        toast.success("Saved to your list", {
          action: { label: "Open guide", onClick: () => (window.location.href = "/saved") },
        });
      }
    },
    [persist],
  );

  const swipeTop = useCallback(
    (direction: Direction) => {
      const top = issues?.[index];
      if (!top) return;
      const api = cardRefs.current.get(top.htmlUrl);
      if (api) void api.swipe(direction);
      else onSwipe(top, direction);
    },
    [issues, index, onSwipe],
  );

  // Keyboard parity with the swipe gesture, for anyone not on a touch device.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") swipeTop("right");
      if (e.key === "ArrowLeft") swipeTop("left");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipeTop]);

  // Render only a few cards deep; the rest mount as the user works down the deck.
  const visible = useMemo(() => (issues ?? []).slice(index, index + 3), [issues, index]);

  if (issues === null) return <FeedSkeleton />;

  if (feed.error && issues.length === 0) {
    return <FeedError message={feed.error} onRetry={feed.load} />;
  }

  if (issues.length === 0 || index >= issues.length) {
    return (
      <FeedExhausted
        filtered={issues.length === 0 && feed.hacktoberfestOnly}
        nothingAtAll={issues.length === 0}
        onRefresh={feed.load}
        onClearFilter={() => feed.setHacktoberfestOnly(false)}
      />
    );
  }

  const top = issues[index];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative h-[640px] w-full max-w-lg sm:h-[680px]">
        {visible
          .slice()
          .reverse()
          .map((issue, reverseIdx) => {
            const depth = visible.length - 1 - reverseIdx;
            return (
              <TinderCard
                key={issue.htmlUrl}
                ref={(api: CardApi | null) => {
                  cardRefs.current.set(issue.htmlUrl, api);
                }}
                className="absolute inset-0"
                onSwipe={(dir) => onSwipe(issue, dir as Direction)}
                preventSwipe={["up", "down"]}
                swipeRequirementType="position"
                swipeThreshold={120}
              >
                <div
                  className="h-full w-full transition-transform duration-200"
                  style={{
                    // Scale from the top edge, otherwise shrinking pulls the
                    // bottom up and cancels the offset that makes the stack read.
                    transformOrigin: "top center",
                    transform: `scale(${1 - depth * 0.035}) translateY(${depth * 30}px)`,
                    opacity: depth === 0 ? 1 : 0.9,
                  }}
                >
                  <IssueCard issue={issue} />
                </div>
              </TinderCard>
            );
          })}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          className="size-14 rounded-full border-border/70 p-0 hover:border-destructive/50 hover:text-destructive"
          onClick={() => swipeTop("left")}
          aria-label="Skip this issue"
        >
          <X className="size-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-xs text-muted-foreground"
          disabled={!lastAction || index === 0}
          onClick={async () => {
            if (!lastAction) return;
            const api = cardRefs.current.get(lastAction.issue.htmlUrl);
            handled.current.delete(lastAction.issue.htmlUrl);
            setIndex((i) => Math.max(0, i - 1));
            setLastAction(null);
            if (api) await api.restoreCard();
          }}
          aria-label="Undo last action"
        >
          <Undo2 className="size-3.5" />
          Undo
        </Button>

        <Button
          size="lg"
          className="size-14 rounded-full p-0"
          onClick={() => swipeTop("right")}
          aria-label="Save this issue"
        >
          <Bookmark className="size-5" />
        </Button>
      </div>

      <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
        <span>
          {issues.length - index} left{hasMore ? "+" : ""}
        </span>
        <span>·</span>
        <span>← skip</span>
        <span>save →</span>
        <span>·</span>
        <a
          href={top.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-3" />
          open on GitHub
        </a>
      </div>
    </div>
  );
}
