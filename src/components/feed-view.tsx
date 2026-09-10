"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Layers, LayoutList, Leaf } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { IssueList } from "@/components/issue-list";
import { FeedHint } from "@/components/feed-hint";
import { useIssueFeed } from "@/hooks/use-issue-feed";
import { cn } from "@/lib/utils";

// react-tinder-card measures the window on mount, so the deck never server-renders.
const IssueDeck = dynamic(() => import("@/components/issue-deck").then((m) => m.IssueDeck), {
  ssr: false,
});

type Mode = "swipe" | "list";
const STORAGE_KEY = "oss-match:feed-mode";

/**
 * Hosts the shared feed state and lets the user pick how to browse it: one
 * card at a time, or a scannable grid. The choice is remembered per browser.
 */
export function FeedView({ hacktoberfestMode = false }: { hacktoberfestMode?: boolean }) {
  const feed = useIssueFeed();
  const [mode, setMode] = useState<Mode>("swipe");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "list" || saved === "swipe") setMode(saved);
    } catch {
      // Storage can be blocked; the default is fine.
    }
  }, []);

  function pick(next: string) {
    if (next !== "swipe" && next !== "list") return;
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  const wide = mode === "list";

  return (
    <div className={cn("mx-auto flex w-full flex-col gap-6", wide ? "max-w-5xl" : "max-w-lg")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={pick}
          aria-label="Feed layout"
          className="rounded-full border border-border/60 bg-card/60 p-0.5"
        >
          <ToggleGroupItem
            value="swipe"
            aria-label="Swipe one card at a time"
            className="h-7 gap-1.5 rounded-full px-3 font-mono text-[11px] data-[state=on]:bg-iris data-[state=on]:text-primary-foreground"
          >
            <Layers className="size-3" />
            Swipe
          </ToggleGroupItem>
          <ToggleGroupItem
            value="list"
            aria-label="Browse as a list"
            className="h-7 gap-1.5 rounded-full px-3 font-mono text-[11px] data-[state=on]:bg-iris data-[state=on]:text-primary-foreground"
          >
            <LayoutList className="size-3" />
            List
          </ToggleGroupItem>
        </ToggleGroup>

        {hacktoberfestMode && (
          <Toggle
            size="sm"
            pressed={feed.hacktoberfestOnly}
            onPressedChange={feed.setHacktoberfestOnly}
            aria-label="Show only Hacktoberfest issues"
            className="h-7 gap-1.5 rounded-full border border-border/60 px-3 font-mono text-[11px] text-muted-foreground data-[state=on]:border-amber/40 data-[state=on]:bg-amber/10 data-[state=on]:text-amber"
          >
            <Leaf className="size-3" />
            Hacktoberfest only
          </Toggle>
        )}
      </div>

      {mode === "swipe" && <FeedHint />}
      {mode === "list" ? <IssueList feed={feed} /> : <IssueDeck feed={feed} />}
    </div>
  );
}
