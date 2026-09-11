"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  ExternalLink,
  ImageIcon,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyBlock } from "@/components/copy-block";
import { MentorCard } from "@/components/mentor-card";
import type { GuideStep } from "@/lib/guide";
import type { SavedIssueRecord } from "@/lib/feed-types";
import type { ContributingSummary } from "@/lib/contributing-types";
import { cn } from "@/lib/utils";
import { Character } from "@/components/landing/story/voxel-figure";

export function ContributionGuide({
  issue,
  steps,
  contributing,
}: {
  issue: SavedIssueRecord;
  steps: GuideStep[];
  contributing: ContributingSummary | null;
}) {
  const [completed, setCompleted] = useState<number[]>(issue.guideProgress ?? []);
  const [status, setStatus] = useState(issue.status);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState<number | null>(null);

  // Land on the first unfinished step rather than always on step one.
  const firstOpen = useMemo(() => {
    const next = steps.find((s) => !(issue.guideProgress ?? []).includes(s.id));
    return String(next?.id ?? steps[0].id);
  }, [steps, issue.guideProgress]);

  const [tab, setTab] = useState(firstOpen);
  const done = completed.length;
  const pct = Math.round((done / steps.length) * 100);

  async function toggleStep(step: number, next: boolean) {
    const previous = completed;
    setCompleted((prev) =>
      next ? Array.from(new Set([...prev, step])).sort((a, b) => a - b) : prev.filter((s) => s !== step),
    );
    setSaving(step);
    try {
      const res = await fetch("/api/issues/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: issue._id, step, completed: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save progress");
      setStatus(data.issue.status);
      if (next && step < steps.length) setTab(String(step + 1));
    } catch (err) {
      setCompleted(previous);
      toast.error(err instanceof Error ? err.message : "Could not save progress");
    } finally {
      setSaving(null);
    }
  }

  async function markContributed() {
    try {
      const res = await fetch("/api/issues/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: issue._id, status: "contributed" }),
      });
      if (!res.ok) throw new Error("Could not update status");
      setStatus("contributed");
      toast.success("Nice. It is on your profile now.");
    } catch {
      toast.error("Could not update status");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <div className="hidden items-end gap-3 lg:flex">
          <Character role="builder" unit={3.8} title="The guide: walks the pull request step by step" />
          <p className="pb-2 font-mono text-[11px] leading-snug text-muted-foreground">
            Step by step,
            <br />
            filled in for this repo.
          </p>
        </div>
        <Card className="border-border/60 bg-card/70">
          <CardHeader className="pb-3">
            <p className="truncate font-mono text-xs text-muted-foreground">
              {issue.repoName}
            </p>
            <CardTitle className="text-pretty text-sm font-medium leading-snug">
              {issue.issueTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>
                {done} / {steps.length} steps
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1" />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge
                variant={status === "contributed" ? "default" : "secondary"}
                className="rounded-full font-mono text-[10px] font-normal"
              >
                {status}
              </Badge>
              {issue.language && (
                <Badge
                  variant="outline"
                  className="rounded-full border-border/60 font-mono text-[10px] font-normal text-muted-foreground"
                >
                  {issue.language}
                </Badge>
              )}
            </div>
            <Button asChild variant="outline" size="sm" className="w-full font-mono text-xs">
              <a href={issue.issueUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3" />
                Issue #{issue.issueNumber}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Tabs
          value={tab}
          onValueChange={setTab}
          orientation="vertical"
          className="w-full"
        >
          <TabsList className="h-auto w-full flex-col items-stretch gap-0.5 bg-transparent p-0">
            {steps.map((step) => {
              const isDone = completed.includes(step.id);
              return (
                <TabsTrigger
                  key={step.id}
                  value={String(step.id)}
                  className={cn(
                    "group justify-start gap-3 rounded-md border border-transparent px-3 py-2.5 text-left data-[state=active]:border-border/70 data-[state=active]:bg-card data-[state=active]:shadow-none",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] tabular-nums transition-colors",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="size-3" /> : step.id}
                  </span>
                  <span
                    className={cn(
                      "truncate font-mono text-xs",
                      isDone && "text-muted-foreground line-through",
                    )}
                  >
                    {step.title}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {done === steps.length && status !== "contributed" && (
          <Button
            className="w-full font-mono text-xs"
            onClick={() => startTransition(markContributed)}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CircleCheck className="size-3.5" />
            )}
            Mark as contributed
          </Button>
        )}
      </aside>

      <div className="min-w-0 space-y-4">
      <MentorCard repo={issue.repoName} issueUrl={issue.issueUrl} variant="banner" />

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        {steps.map((step) => (
          <TabsContent key={step.id} value={String(step.id)} className="mt-0">
            <Card className="border-border/60 bg-card/70">
              <CardHeader className="gap-2 border-b border-border/60">
                <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span>step {String(step.id).padStart(2, "0")}</span>
                  <span>/</span>
                  <span>{String(steps.length).padStart(2, "0")}</span>
                </div>
                <CardTitle className="font-mono text-lg tracking-tight">
                  {step.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{step.blurb}</p>
              </CardHeader>

              <CardContent className="space-y-4 pt-6">
                {step.id === 3 && contributing?.hasContributing && contributing.summary && (
                  <ContributingCard contributing={contributing} />
                )}

                {step.blocks.map((block, i) => (
                  <GuideBlockView key={i} block={block} />
                ))}

                <Separator className="bg-border/60" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={completed.includes(step.id)}
                      disabled={saving === step.id}
                      onCheckedChange={(v) => toggleStep(step.id, v === true)}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      {saving === step.id ? "saving…" : "I have done this step"}
                    </span>
                  </label>

                  {step.id < steps.length && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="font-mono text-xs text-muted-foreground"
                      onClick={() => setTab(String(step.id + 1))}
                    >
                      Next step
                      <ArrowRight className="size-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </div>
  );
}

export function GuideBlockView({ block }: { block: GuideStep["blocks"][number] }) {
  switch (block.kind) {
    case "text":
      return (
        <p className="text-sm leading-relaxed text-foreground/85">{block.body}</p>
      );
    case "command":
      return <CopyBlock code={block.code} label={block.label} variant="command" />;
    case "template":
      return <CopyBlock code={block.code} label={block.label} variant="template" />;
    case "link":
      return (
        <Button asChild variant="outline" size="sm" className="font-mono text-xs">
          <a href={block.href} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3" />
            {block.label}
          </a>
        </Button>
      );
    case "screenshot":
      return (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/70 bg-secondary/20 px-4 py-6">
          <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {block.caption}
          </p>
        </div>
      );
    case "tip":
      return (
        <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-foreground/80">{block.body}</p>
        </div>
      );
  }
}

function ContributingCard({ contributing }: { contributing: ContributingSummary }) {
  const { summary } = contributing;
  if (!summary) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {contributing.path}
        </span>
        {contributing.htmlUrl && (
          <Button asChild variant="ghost" size="sm" className="h-6 px-2 font-mono text-[10px]">
            <a href={contributing.htmlUrl} target="_blank" rel="noreferrer">
              read in full
            </a>
          </Button>
        )}
      </div>

      {summary.intro && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {summary.intro}
        </p>
      )}

      {summary.sections.length > 0 && (
        <ul className="space-y-2">
          {summary.sections.map((s) => (
            <li key={s.heading} className="space-y-0.5">
              <p className="font-mono text-xs text-foreground/90">{s.heading}</p>
              {s.excerpt && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {s.excerpt}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
