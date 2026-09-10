import { Boxes, GitCommitHorizontal, Leaf, LockKeyhole, MessageCircleQuestion, RefreshCw, Sparkles, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What you actually get, as a bento grid. Each tile carries its own small
 * illustration so the section reads as designed rather than listed.
 */
export function Bento() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <Tile className="lg:col-span-4" icon={Sparkles} title="Scored, not scraped" body="Every card carries its six-factor breakdown. If an issue ranks above another, you can see exactly why.">
        <ScoreSparkline />
      </Tile>

      <Tile className="lg:col-span-2" icon={Terminal} title="Copy-paste ready" body="Clone, branch, commit and PR commands filled in with the repo and issue you picked.">
        <CommandChips />
      </Tile>

      <Tile className="lg:col-span-2" icon={LockKeyhole} title="Reads only" body="The OAuth app asks for read:user and user:email. Nothing that can touch your repos.">
        <Shield />
      </Tile>

      <Tile className="lg:col-span-2" icon={RefreshCw} title="Fresh every hour" body="A background job refreshes the index on a schedule. Your feed never waits on GitHub.">
        <Orbit />
      </Tile>

      <Tile className="lg:col-span-2" icon={Leaf} title="Hacktoberfest aware" body="Flip one flag and hacktoberfest-labelled issues get indexed faster and badged in the feed.">
        <LeafMark />
      </Tile>

      <Tile className="lg:col-span-3" icon={GitCommitHorizontal} title="A skill graph from your real commits" body="Not what you tick in a form. Your public repos, commit history and merged PRs, read and rated per language, so the ranking reflects what you have actually shipped.">
        <SkillBars />
      </Tile>

      <Tile className="lg:col-span-3" icon={MessageCircleQuestion} title="The best person to ask, per issue" body="Who is answering on that repo right now, from the last 60 days of comments and reviews. Often not the owner. Named on the card, so you never post into a void.">
        <AskChip />
      </Tile>

      <Tile className="lg:col-span-6" icon={Boxes} title="A Deep Dive into the repo before you clone it" body="The whole codebase as an isometric map, a 3D architecture graph stacked from entry points down to data, and a drawn path from the issue to the files it touches. Every block clickable, every step explained in plain words.">
        <IsoPreview />
      </Tile>
    </div>
  );
}

function Tile({
  icon: Icon,
  title,
  body,
  className,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-iris/50",
        className,
      )}
    >
      <div className="relative flex-1">{children}</div>
      <div className="mt-6">
        <h3 className="flex items-center gap-2 font-mono text-sm font-medium">
          <Icon className="size-3.5 text-iris" />
          {title}
        </h3>
        <p className="mt-2 text-pretty text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

/* --- illustrations ------------------------------------------------------ */

function ScoreSparkline() {
  const rows = [
    { label: "language", v: 100, c: "bg-iris" },
    { label: "repo health", v: 92, c: "bg-neon" },
    { label: "freshness", v: 100, c: "bg-amber" },
    { label: "unclaimed", v: 80, c: "bg-neon/70" },
    { label: "difficulty", v: 100, c: "bg-iris/70" },
    { label: "welcoming", v: 100, c: "bg-rose" },
  ];
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>{r.label}</span>
            <span className="tabular-nums">{r.v}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
            <div
              className={cn("h-full rounded-full origin-left animate-rise-in", r.c)}
              style={{ width: `${r.v}%`, animationDelay: `${i * 80}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommandChips() {
  const cmds = ["git clone", "git checkout -b", "git commit", "git push -u"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {cmds.map((c, i) => (
        <span
          key={c}
          className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] animate-rise-in"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <span className="text-iris">$</span> {c}
        </span>
      ))}
    </div>
  );
}

function Shield() {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-full" fill="none" aria-hidden>
      <path
        d="M60 8 L92 20 V42 C92 58 78 68 60 74 C42 68 28 58 28 42 V20 Z"
        className="fill-iris/10 stroke-iris"
        strokeWidth="1.5"
      />
      <path d="M48 42 L56 50 L72 32" className="stroke-neon" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="60" y="66" textAnchor="middle" className="fill-muted-foreground font-mono text-[7px]">read:user</text>
    </svg>
  );
}

function Orbit() {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-full" fill="none" aria-hidden>
      <ellipse cx="60" cy="40" rx="46" ry="22" className="stroke-border" strokeWidth="1" />
      <ellipse cx="60" cy="40" rx="30" ry="14" className="stroke-border" strokeWidth="1" />
      <circle cx="60" cy="40" r="6" className="fill-iris" />
      <circle cx="14" cy="40" r="3" className="fill-neon animate-pulse" />
      <circle cx="90" cy="26" r="2.5" className="fill-amber" />
      <text x="60" y="72" textAnchor="middle" className="fill-muted-foreground font-mono text-[7px]">every 60 min</text>
    </svg>
  );
}

function SkillBars() {
  const rows = [
    { lang: "TypeScript", level: "advanced", w: 96, c: "bg-iris" },
    { lang: "Python", level: "intermediate", w: 68, c: "bg-neon" },
    { lang: "Go", level: "beginner", w: 38, c: "bg-amber" },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.lang}>
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span>{r.lang}</span>
            <span className="text-muted-foreground">{r.level} · from 41 commits, 3 PRs</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
            <div className={cn("h-full rounded-full animate-rise-in", r.c)} style={{ width: `${r.w}%`, animationDelay: `${i * 90}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AskChip() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 rounded-lg border border-neon/30 bg-neon/5 px-3 py-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-neon/20 font-mono text-[10px] text-neon">tm</span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-neon">ask @tentoumushii</p>
          <p className="truncate text-[11px] text-muted-foreground">22 comments in 60 days, active today, welcomes first-timers</p>
        </div>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">ranked from real activity · not the repo owner</p>
    </div>
  );
}

function IsoPreview() {
  // A tiny static isometric city: three rows of blocks, the middle one lit.
  const blocks = [
    { x: 0, y: 0, h: 14, lit: false }, { x: 1, y: 0, h: 18, lit: false }, { x: 2, y: 0, h: 14, lit: true },
    { x: 3, y: 0, h: 22, lit: false }, { x: 0, y: 1, h: 10, lit: false }, { x: 1, y: 1, h: 26, lit: true },
    { x: 2, y: 1, h: 12, lit: false }, { x: 1, y: 2, h: 16, lit: false }, { x: 2, y: 2, h: 20, lit: false },
  ];
  const W = 34, H = 17;
  return (
    <svg viewBox="-20 -10 200 110" className="h-28 w-full" aria-hidden>
      <defs>
        <linearGradient id="bt-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="hsl(var(--iris))" stopOpacity="0.95" /><stop offset="1" stopColor="hsl(var(--iris))" stopOpacity="0.65" /></linearGradient>
        <linearGradient id="bt-lit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="hsl(var(--cyan))" stopOpacity="0.95" /><stop offset="1" stopColor="hsl(var(--cyan))" stopOpacity="0.65" /></linearGradient>
      </defs>
      {blocks
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((b, i) => {
          const cx = (b.x - b.y) * (W / 2) + 90, cy = (b.x + b.y) * (H / 2) + 30;
          const w = W - 6, h = H - 3;
          return (
            <g key={i} className="animate-rise-in" style={{ animationDelay: `${i * 70}ms` }}>
              <polygon points={`${cx - w / 2},${cy} ${cx},${cy + h / 2} ${cx},${cy + h / 2 + b.h} ${cx - w / 2},${cy + b.h}`} fill={b.lit ? "hsl(var(--cyan) / 0.45)" : "hsl(var(--iris) / 0.4)"} />
              <polygon points={`${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx},${cy + h / 2 + b.h} ${cx + w / 2},${cy + b.h}`} fill={b.lit ? "hsl(var(--cyan) / 0.3)" : "hsl(var(--iris) / 0.25)"} />
              <polygon points={`${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`} fill={b.lit ? "url(#bt-lit)" : "url(#bt-top)"} stroke="hsl(var(--background) / 0.6)" strokeWidth="0.6" />
            </g>
          );
        })}
      <text x="160" y="96" textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 7 }}>lit blocks = where your issue lives</text>
    </svg>
  );
}

function LeafMark() {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-full" fill="none" aria-hidden>
      <path
        d="M30 62 C30 30 56 14 92 16 C92 50 70 70 38 66 Z"
        className="fill-amber/15 stroke-amber"
        strokeWidth="1.5"
      />
      <path d="M36 64 C50 48 66 36 86 22" className="stroke-amber" strokeWidth="1.2" strokeLinecap="round" />
      <text x="60" y="76" textAnchor="middle" className="fill-muted-foreground font-mono text-[7px]">HACKTOBERFEST_MODE=true</text>
    </svg>
  );
}
