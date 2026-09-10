"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "oss-match:feed-hint-dismissed";

/** One-time orientation for the swipe deck. Dismissed state is remembered. */
export function FeedHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="flex w-full items-start gap-3 rounded-xl border border-iris/25 bg-iris/5 px-4 py-3 animate-rise-in">
      <Keyboard className="mt-0.5 size-4 shrink-0 text-iris" />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground/85">
        <span className="font-medium">Drag the card</span> or use the buttons.
        <span className="mx-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]">
          <ArrowRight className="size-3" /> save
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]">
          <ArrowLeft className="size-3" /> skip
        </span>
        <span className="text-muted-foreground"> Arrow keys work too. Prefer to scan? Switch to List.</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground"
        aria-label="Dismiss hint"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // ignore
          }
        }}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
