"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copies the current page URL. Falls back gracefully where clipboard is blocked. */
export function CopyLinkButton({ label = "Share" }: { label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="font-mono text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard unavailable; the URL bar still works.
        }
      }}
    >
      {copied ? <Check className="size-3.5 text-iris" /> : <Share2 className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
