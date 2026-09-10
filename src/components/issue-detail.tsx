"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  CircleDot,
  ExternalLink,
  GitFork,
  Loader2,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Star,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HacktoberfestBadge } from "@/components/issue-card";
import { GuideBlockView } from "@/components/contribution-guide";
import { MentorCard } from "@/components/mentor-card";
import { DeepDiveButton } from "@/components/deepdive/deep-dive-button";
import { looksHacktoberfest } from "@/lib/fetcher/queries";
import { factorTone } from "@/lib/factor-tones";
import type { FeedIssue } from "@/lib/feed-types";
import type { GuideStep } from "@/lib/guide";
import { compactNumber, plainPreview, relativeTime, scoreTone } from "@/lib/format";
import { cn } from "@/lib/utils";

export function IssueDetail({
  issue,
  steps,
  deepDiveAvailable = true,
}: {
  issue: FeedIssue;
  steps: GuideStep[];
  /** False when a previous attempt found the repo private or gone. */
  deepDiveAvailable?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"save" | "skip" | null>(null);
  const [openStep, setOpenStep] = useState<number>(steps[0]?.id ?? 1);
  const [showBody, setShowBody] = useState(false);

  const hacktoberfest = looksHacktoberfest(issue.labels);
  const preview = plainPreview(issue.body ?? "", showBody ? 4000 : 520);

  async function act(action: "save" | "skip") {
    setBusy(action);
    try {
      const res = await fetch("/api/issues/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          issueUrl: issue.htmlUrl,
          issueNumber: issue.number,
          issueTitle: issue.title,
          issueBody: issue.body,
          repoName: issue.repoFullName,
          repoUrl: issue.repoUrl,
          cloneUrl: issue.repo.cloneUrl,
          defaultBranch: issue.repo.defaultBranch,
          language: issue.repo.language,
          labels: issue.labels,
          matchScore: issue.matchScore,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (action === "save" && data.id) {
        toast.success("Saved. Your progress is tracked from here.");
        router.push(`/guide/${data.id}`);
      } else {
        router.push("/feed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 font-mono text-xs text-muted-foreground">
        <Link href="/feed">
          <ArrowLeft className="size-3.5" />
          Back to feed
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ---------------------------------------------------- the issue */}
        <section className="min-w-0 space-y-6">
          <header className="rounded-2xl border border-border/70 bg-card/80 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <a href={issue.repoUrl} target="_blank" rel="noreferrer" className="truncate hover:text-foreground">
                {issue.repoFullName}
              </a>
              <span>#{issue.number}</span>
              {hacktoberfest && <HacktoberfestBadge />}
            </div>

            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <h1 className="min-w-0 text-pretty font-mono text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
                {issue.title}
              </h1>
              {deepDiveAvailable && issue.cacheId && (
                <DeepDiveButton
                  className="shrink-0"
                  repo={issue.repoFullName}
                  repoUrl={issue.repoUrl}
                  defaultBranch={issue.repo.defaultBranch}
                  issueId={issue.cacheId}
                  issueTitle={issue.title}
                />
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Star className="size-3" />{compactNumber(issue.repo.stars)}</span>
              <span className="flex items-center gap-1"><GitFork className="size-3" />{compactNumber(issue.repo.forks)}</span>
              {issue.repo.language && <span className="text-iris">{issue.repo.language}</span>}
              <span className="flex items-center gap-1"><CircleDot className="size-3" />opened {relativeTime(issue.createdAt)}</span>
              <span className="flex items-center gap-1"><MessageSquare className="size-3" />{issue.comments} comments</span>
              <span>pushed {relativeTime(issue.repo.pushedAt)}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {issue.labels.map((l) => (
                <Badge key={l} variant="secondary" className="rounded-full font-mono text-[10px] font-normal">
                  {l}
                </Badge>
              ))}
            </div>

            {preview && (
              <div className="mt-6 border-t border-border/60 pt-5">
                <p className="text-pretty text-[14px] leading-relaxed text-foreground/85">{preview}</p>
                {(issue.body?.length ?? 0) > 520 && (
                  <button
                    type="button"
                    onClick={() => setShowBody((v) => !v)}
                    className="mt-3 flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {showBody ? "show less" : "read the full issue"}
                    <ChevronDown className={cn("size-3 transition-transform", showBody && "rotate-180")} />
                  </button>
                )}
              </div>
            )}
          </header>

          <MentorCard repo={issue.repoFullName} issueUrl={issue.htmlUrl} variant="banner" />

          {/* ---------------------------------------------------- the guide */}
          <div>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-iris">
                  <span className="h-px w-6 bg-iris" />
                  how to contribute
                </p>
                <h2 className="mt-2 font-mono text-xl font-semibold tracking-tight">
                  Eight steps, filled in for this repo
                </h2>
              </div>
              <p className="hidden text-right font-mono text-[11px] text-muted-foreground sm:block">
                save it to tick steps off
              </p>
            </div>

            <ol className="space-y-2">
              {steps.map((step) => {
                const open = openStep === step.id;
                return (
                  <li key={step.id} className={cn("rounded-xl border bg-card/70 transition-colors", open ? "border-iris/40" : "border-border/70")}>
                    <button
                      type="button"
                      onClick={() => setOpenStep(open ? 0 : step.id)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-4 px-4 py-3.5 text-left"
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums",
                          open ? "border-iris bg-iris text-primary-foreground" : "border-border text-muted-foreground",
                        )}
                      >
                        {step.id}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-medium">{step.title}</span>
                        <span className="block truncate text-[12px] text-muted-foreground">{step.blurb}</span>
                      </span>
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-border/60 px-4 py-4">
                        {step.blocks.map((block, i) => (
                          <GuideBlockView key={i} block={block} />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------- the score */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-5">
            <div className="flex items-end justify-between">
              <div>
                <div className={cn("font-mono text-5xl font-semibold tabular-nums leading-none", scoreTone(issue.matchScore))}>
                  {Math.round(issue.matchScore * 100)}
                </div>
                <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">match for you</div>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {Object.entries(issue.breakdown).map(([key, value]) => {
                const tone = factorTone(key);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                      <span>{tone.label}</span>
                      <span className="tabular-nums">{Math.round(value * 100)}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
                      <div className={cn("h-full rounded-full", tone.bg)} style={{ width: `${value * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {issue.reasons.length > 0 && (
              <ul className="mt-5 space-y-1.5 border-t border-border/60 pt-4">
                {issue.reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <Zap className="mt-0.5 size-3 shrink-0 text-iris" />
                    {r}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
              {issue.repo.hasContributing && <span className="flex items-center gap-1 text-iris/80"><ScrollText className="size-3" />CONTRIBUTING.md</span>}
              {issue.repo.hasCodeOfConduct && <span className="flex items-center gap-1"><ShieldCheck className="size-3" />code of conduct</span>}
              {issue.repo.hasCi && <span>CI</span>}
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-iris/30 bg-iris/5 p-4">
            <Button className="w-full font-mono" disabled={busy !== null} onClick={() => act("save")}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Bookmark className="size-4" />}
              Save &amp; start the guide
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="font-mono text-xs" disabled={busy !== null} onClick={() => act("skip")}>
                {busy === "skip" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                Skip
              </Button>
              <Button asChild variant="outline" className="font-mono text-xs">
                <a href={issue.htmlUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  GitHub
                </a>
              </Button>
            </div>
            <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
              Saving keeps your step-by-step progress on this issue.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
