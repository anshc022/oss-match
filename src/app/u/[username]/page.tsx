import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, GitPullRequest, Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { User } from "@/models/User";
import { SavedIssue } from "@/models/SavedIssue";
import { SiteHeader } from "@/components/site-header";
import { ShaderBackground } from "@/components/shader-background";
import { StatTile } from "@/components/page-header";
import { CopyLinkButton } from "@/components/copy-link-button";
import { SkillGraphCard } from "@/components/skill-graph-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { INTEREST_COPY, SKILL_LEVEL_COPY, type Interest, type SkillLevel } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { username: string } }) {
  return { title: `@${params.username}` };
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  await dbConnect();
  const [user, session] = await Promise.all([
    User.findOne({ username: params.username }).lean(),
    auth(),
  ]);
  if (!user) notFound();

  const isOwner = session?.user?.username === user.username;

  // Only contributed issues are public. Saved and in-progress stay private.
  const contributions = await SavedIssue.find({ userId: user._id, status: "contributed" })
    .sort({ updatedAt: -1 })
    .lean();

  const languages = user.languages ?? [];
  const interests = (user.interests ?? []) as Interest[];
  const repos = new Set(contributions.map((c) => c.repoName)).size;
  const contributedLanguages = new Set(contributions.map((c) => c.language).filter(Boolean)).size;
  const memberSince = user.createdAt ? new Date(user.createdAt as unknown as string) : null;

  return (
    <div className="relative min-h-dvh">
      <ShaderBackground opacity={0.22} />
      <SiteHeader />

      <main className="container max-w-3xl py-12">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar className="size-20 border-2 border-iris/30">
            <AvatarImage src={user.avatarUrl} alt={user.username} />
            <AvatarFallback className="font-mono">{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-iris">
              <span className="h-px w-6 bg-iris" />
              profile
            </p>
            <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">@{user.username}</h1>
            {user.name && <p className="mt-0.5 text-sm text-muted-foreground">{user.name}</p>}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {user.skillLevel && (
                <Badge variant="outline" className="rounded-full border-iris/30 bg-iris/5 font-mono text-[10px] font-normal text-iris">
                  {SKILL_LEVEL_COPY[user.skillLevel as SkillLevel]?.label ?? user.skillLevel}
                </Badge>
              )}
              {languages.slice(0, 6).map((lang) => (
                <Badge key={lang} variant="secondary" className="rounded-full font-mono text-[10px] font-normal">
                  {lang}
                </Badge>
              ))}
              {interests.map((i) => (
                <Badge key={i} variant="outline" className="rounded-full border-border/60 font-mono text-[10px] font-normal text-muted-foreground">
                  {INTEREST_COPY[i]?.label ?? i}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CopyLinkButton />
            {isOwner && (
              <Button asChild variant="ghost" size="sm" className="font-mono text-xs text-muted-foreground">
                <Link href="/onboarding">Edit</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile n={contributions.length} label="contributions" tone="iris" />
          <StatTile n={repos} label="repos" />
          <StatTile n={contributedLanguages} label="languages shipped" />
          <StatTile n={memberSince ? memberSince.toLocaleDateString("en", { month: "short", year: "numeric" }) : "—"} label="member since" />
        </div>

        <div className="mt-10">
          <SkillGraphCard
            initial={
              user.skillGraph
                ? (JSON.parse(JSON.stringify(user.skillGraph)) as Parameters<typeof SkillGraphCard>[0]["initial"])
                : null
            }
            initialStatus={user.skillGraphStatus ?? "idle"}
            isOwner={isOwner}
            selfReported={(user.skillLevel as SkillLevel | null) ?? null}
          />
        </div>

        <h2 className="mb-4 mt-12 flex items-center gap-2 font-mono text-sm font-medium">
          <Trophy className="size-3.5 text-iris" />
          Contributions
        </h2>

        {contributions.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-10 text-center">
            <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-neon/10 blur-3xl" />
            <div className="relative mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-background">
              <GitPullRequest className="size-5 text-muted-foreground" />
            </div>
            <h3 className="relative mt-5 font-mono text-base font-medium">Nothing on the board yet</h3>
            <p className="relative mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
              {isOwner
                ? "Finish an issue's guide and mark it contributed from your list. It shows up here as your public portfolio."
                : `@${user.username} has not marked any contributions yet.`}
            </p>
            {isOwner && (
              <div className="relative mt-6">
                <Button asChild size="sm" className="font-mono text-xs">
                  <Link href="/saved">Go to my list</Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {contributions.map((c) => (
              <li key={String(c._id)}>
                <a
                  href={c.issueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-card/80 p-4 transition-colors hover:border-iris/40"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {c.repoName} · #{c.issueNumber}
                    </p>
                    <p className="text-pretty text-sm font-medium leading-snug transition-colors group-hover:text-iris">
                      {c.issueTitle}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {c.language && <span className="text-iris/80">{c.language}</span>}
                      {c.language && " · "}
                      {relativeTime(c.savedAt)}
                    </p>
                  </div>
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 text-center font-mono text-[11px] text-muted-foreground">
          Portfolio built on{" "}
          <Link href="/" className="text-iris hover:underline">
            {BRAND.wordmark.lead}/{BRAND.wordmark.tail}
          </Link>
        </p>
      </main>
    </div>
  );
}
