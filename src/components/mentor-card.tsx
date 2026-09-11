"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink, Loader2, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Character } from "@/components/landing/story/voxel-figure";

type Mentor = { username: string; avatarUrl: string; reason: string };
type Payload = { mentors: Mentor[]; computing: boolean; source: string; aiEnabled: boolean };

/**
 * Who is actually answering on this repo right now, so a newcomer has a name
 * rather than a void. Fetches client-side so the page never waits on it, and
 * always renders a state, never nothing.
 *
 * `banner` is the full-width form for the top of a page; `card` is the
 * compact sidebar form.
 */
export function MentorCard({
  repo,
  issueUrl,
  variant = "card",
  className,
}: {
  repo: string;
  /** When given, the primary action deep-links to the issue's comment box. */
  issueUrl?: string;
  variant?: "banner" | "card";
  className?: string;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    async function load() {
      try {
        const res = await fetch(`/api/repos/mentors?repo=${encodeURIComponent(repo)}`);
        if (!res.ok) return;
        const json = (await res.json()) as Payload;
        if (cancelled) return;
        setData(json);
        if (json.computing) {
          if (tries++ < 6) setTimeout(load, 5000);
          else setGaveUp(true);
        }
      } catch {
        if (!cancelled) setGaveUp(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const computing = Boolean(data?.computing) && !gaveUp;
  const mentors = data?.mentors ?? [];
  const lead = mentors[0];
  const askHref = issueUrl ? `${issueUrl}#new_comment_field` : lead ? `https://github.com/${lead.username}` : undefined;

  if (variant === "banner") {
    return (
      <section
        aria-label="Best person to ask"
        className={cn("relative overflow-hidden rounded-2xl border border-neon/40 bg-card/80", className)}
      >
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-neon/15 blur-3xl" />

        {/* Slim header strip; keeps the body row free for the person. */}
        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-neon/20 bg-neon/5 px-5 py-2.5">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-neon">
            <MessageCircleQuestion className="size-4" />
            best person to ask
          </p>
          <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            {data?.source === "ai" && <Sparkles className="size-3 text-neon" />}
            {data?.source === "ai" ? "AI-ranked from the last 60 days of activity" : "from the last 60 days of activity"}
          </p>
        </div>

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="hidden sm:order-last sm:ml-auto sm:block">
            <Character role="headset" unit={3.6} title="Mentor: the person to ask first" />
          </div>
          {!data && (
            <p className="flex items-center gap-2 font-mono text-[12px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> checking who is active on {repo}…
            </p>
          )}
          {data && computing && !lead && (
            <p className="flex items-center gap-2 font-mono text-[12px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> reading the last 60 days of comments and reviews…
            </p>
          )}
          {data && !computing && !lead && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {gaveUp
                ? "Still working on this repo. Check back in a minute."
                : "Nobody has commented or reviewed here in the last 60 days. Ask on the issue itself; a quiet repo can still answer."}
            </p>
          )}

          {lead && (
            <>
              <Avatar className="size-16 shrink-0 border-2 border-neon/60">
                <AvatarImage src={lead.avatarUrl} alt={lead.username} />
                <AvatarFallback className="font-mono text-sm">{lead.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <a
                  href={`https://github.com/${lead.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xl font-semibold tracking-tight hover:text-neon"
                >
                  @{lead.username}
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                  <span className="ml-1 rounded-full bg-neon/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-neon">
                    ask first
                  </span>
                </a>
                <p className="mt-1 text-pretty text-[13px] leading-relaxed text-foreground/85">{lead.reason}</p>
                {mentors[1] && (
                  <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                    also active:{" "}
                    <a href={`https://github.com/${mentors[1].username}`} target="_blank" rel="noreferrer" className="text-foreground hover:text-neon">
                      @{mentors[1].username}
                    </a>
                  </p>
                )}
              </div>

              {askHref && (
                <div className="sm:w-52 sm:shrink-0">
                  <Button asChild className="w-full bg-neon font-mono text-background hover:bg-neon/90">
                    <a href={askHref} target="_blank" rel="noreferrer" title={`Ask @${lead.username} on the issue`}>
                      Ask on the issue
                      <ArrowUpRight className="size-4" />
                    </a>
                  </Button>
                  <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground">
                    A suggestion, not a promise. Mention them with a specific question.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-neon/30 bg-card/80", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-neon/20 bg-neon/5 px-4 py-2.5">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-neon">
          <MessageCircleQuestion className="size-3.5" />
          best person to ask
        </p>
        {data?.source === "ai" && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Sparkles className="size-3 text-neon" />
            AI-ranked
          </span>
        )}
      </div>
      <div className="p-4">
        {!data && (
          <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> checking who is active…
          </p>
        )}
        {data && computing && !lead && (
          <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> reading recent comments and reviews…
          </p>
        )}
        {data && !computing && !lead && (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {gaveUp ? "Still working on this repo. Check back in a minute." : "Nobody active here in the last 60 days. Ask on the issue itself."}
          </p>
        )}
        {mentors.length > 0 && (
          <ul className="space-y-3">
            {mentors.slice(0, 2).map((m, i) => (
              <li key={m.username}>
                <a href={`https://github.com/${m.username}`} target="_blank" rel="noreferrer" className="group flex items-start gap-3">
                  <Avatar className={cn("border", i === 0 ? "size-10 border-neon/50" : "size-8 border-border/60")}>
                    <AvatarImage src={m.avatarUrl} alt={m.username} />
                    <AvatarFallback className="font-mono text-[10px]">{m.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-mono text-sm font-medium transition-colors group-hover:text-neon">
                      @{m.username}
                      <ExternalLink className="size-3 text-muted-foreground" />
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{m.reason}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 border-t border-border/60 pt-3 text-[10px] leading-relaxed text-muted-foreground">
          Suggested from recent activity, not a promise they will reply.
        </p>
      </div>
    </div>
  );
}
