"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A terminal that replays the contribution guide for a real repo, one command
 * at a time. Purely illustrative, but every line is a command the guide
 * actually generates.
 */

type Line = { kind: "cmd" | "out" | "ok"; text: string };

const SCRIPT: Line[] = [
  { kind: "cmd", text: "git clone https://github.com/you/excalidraw.git" },
  { kind: "out", text: "Cloning into 'excalidraw'... done." },
  { kind: "cmd", text: "cd excalidraw && git remote add upstream https://github.com/excalidraw/excalidraw.git" },
  { kind: "cmd", text: "git checkout -b fix/8412-announce-duplicate" },
  { kind: "out", text: "Switched to a new branch 'fix/8412-announce-duplicate'" },
  { kind: "cmd", text: "git commit -am \"fix: announce duplicate to screen readers\"" },
  { kind: "out", text: "[fix/8412-announce-duplicate 3e1f9a2] 1 file changed, 12 insertions(+)" },
  { kind: "cmd", text: "git push -u origin fix/8412-announce-duplicate" },
  { kind: "ok", text: "remote: Create a pull request for 'fix/8412-announce-duplicate' → Fixes #8412" },
];

const TYPE_MS = 22;
const LINE_PAUSE_MS = 520;
const LOOP_PAUSE_MS = 4200;

export function TerminalReplay({ className }: { className?: string }) {
  const [reduce, setReduce] = useState(false);
  const [done, setDone] = useState<Line[]>([]);
  const [typing, setTyping] = useState("");
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
  }, []);

  useEffect(() => {
    if (reduce) {
      setDone(SCRIPT);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function run() {
      // eslint-disable-next-line no-constant-condition
      while (!cancelled) {
        setDone([]);
        for (const line of SCRIPT) {
          if (cancelled) return;
          if (line.kind === "cmd") {
            for (let i = 1; i <= line.text.length; i++) {
              if (cancelled) return;
              setTyping(line.text.slice(0, i));
              await wait(TYPE_MS);
            }
            setTyping("");
          }
          setDone((d) => [...d, line]);
          await wait(line.kind === "cmd" ? 180 : LINE_PAUSE_MS);
        }
        await wait(LOOP_PAUSE_MS);
      }
    }
    function wait(ms: number) {
      return new Promise<void>((r) => {
        timer = setTimeout(r, ms);
      });
    }
    void run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setCursorOn((c) => !c), 530);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-iris/10",
        className,
      )}
      aria-label="Example terminal session"
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-rose/80" />
        <span className="size-2.5 rounded-full bg-amber/80" />
        <span className="size-2.5 rounded-full bg-neon/80" />
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">
          ~/excalidraw — first contribution
        </span>
      </div>
      <div className="min-h-[248px] space-y-1.5 p-4 font-mono text-[12px] leading-relaxed">
        {done.map((line, i) => (
          <div key={i} className={cn("break-all", toneOf(line.kind))}>
            {line.kind === "cmd" && <span className="select-none text-iris">$ </span>}
            {line.kind === "ok" && <span className="select-none">✓ </span>}
            {line.text}
          </div>
        ))}
        {!reduce && (
          <div className="break-all text-foreground">
            <span className="select-none text-iris">$ </span>
            {typing}
            <span
              className={cn(
                "ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[2px] bg-iris",
                !cursorOn && "opacity-0",
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function toneOf(kind: Line["kind"]) {
  if (kind === "cmd") return "text-foreground";
  if (kind === "ok") return "text-neon";
  return "text-muted-foreground";
}
