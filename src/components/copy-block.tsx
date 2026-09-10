"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyBlock({
  code,
  label,
  variant = "command",
}: {
  code: string;
  label?: string;
  variant?: "command" | "template";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is blocked in some embedded contexts; the text stays selectable.
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-secondary/30">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label ?? (variant === "command" ? "terminal" : "template")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 font-mono text-[10px] text-muted-foreground hover:text-foreground"
          onClick={copy}
        >
          {copied ? (
            <Check className="size-3 text-primary" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? "copied" : "copy"}
        </Button>
      </div>
      <pre
        className={cn(
          "overflow-x-auto px-3 py-3 font-mono text-xs leading-relaxed",
          variant === "command" ? "text-primary/90" : "text-foreground/85",
        )}
      >
        <code>
          {variant === "command"
            ? code
                .split("\n")
                .map((line, i) => (
                  <span key={i} className="block">
                    <span className="select-none text-muted-foreground">$ </span>
                    {line}
                  </span>
                ))
            : code}
        </code>
      </pre>
    </div>
  );
}
