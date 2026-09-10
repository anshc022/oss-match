"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPRING, useReduced } from "@/components/deepdive/motion-bits";
import { cn } from "@/lib/utils";

const DeepDiveSheet = dynamic(() => import("@/components/deepdive/deep-dive-sheet").then((m) => m.DeepDiveSheet), { ssr: false });

type Ripple = { id: number; x: number; y: number };

/**
 * Opens the Repo Deep Dive. Hover lifts and glows, tap ripples from the
 * pointer, and the sheet scales in from where this button sits.
 */
export function DeepDiveButton({
  repo,
  repoUrl,
  defaultBranch,
  issueId,
  issueTitle,
  className,
}: {
  repo: string;
  repoUrl: string;
  defaultBranch: string;
  issueId?: string;
  issueTitle: string;
  className?: string;
}) {
  const reduced = useReduced();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  return (
    <>
      <motion.div
        className={cn("relative inline-block", className)}
        whileHover={reduced ? undefined : { scale: 1.03 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        transition={SPRING}
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-lg bg-iris/40 blur-md"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: reduced ? 0 : 0.9 }}
          transition={{ duration: 0.2 }}
        />
        <Button
          className="relative overflow-hidden font-mono"
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const id = Date.now();
            setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
            setTimeout(() => setRipples((rs) => rs.filter((x) => x.id !== id)), 600);
          }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
            setOpen(true);
          }}
        >
          <Boxes className="size-4" />
          Deep Dive
          <AnimatePresence>
            {!reduced &&
              ripples.map((rp) => (
                <motion.span
                  key={rp.id}
                  aria-hidden
                  className="pointer-events-none absolute size-4 rounded-full bg-background/50"
                  style={{ left: rp.x - 8, top: rp.y - 8 }}
                  initial={{ scale: 0, opacity: 0.7 }}
                  animate={{ scale: 12, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              ))}
          </AnimatePresence>
        </Button>
      </motion.div>

      {open && (
        <DeepDiveSheet
          open={open}
          onOpenChange={setOpen}
          origin={origin}
          repo={repo}
          repoUrl={repoUrl}
          defaultBranch={defaultBranch}
          issueId={issueId}
          issueTitle={issueTitle}
        />
      )}
    </>
  );
}
