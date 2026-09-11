import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { ShaderBackground } from "@/components/shader-background";
import { SignInButton } from "@/components/sign-in-button";
import { GithubMark } from "@/components/github-mark";
import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/landing-nav";
import { HeroScene } from "@/components/landing/hero-scene";
import { LogoMarquee } from "@/components/landing/logo-marquee";
import { StoryChapter } from "@/components/landing/story-chapter";
import { TerminalReplay } from "@/components/landing/terminal-replay";
import { Bento } from "@/components/landing/bento";
import { getLandingStats } from "@/lib/landing-stats";
import { ScoreAnatomy } from "@/components/landing/score-anatomy";
import { Pipeline } from "@/components/landing/pipeline";
import { SectionIndex } from "@/components/landing/section-index";
import { ContributeBanner } from "@/components/landing/contribute-banner";
import { GUIDE_STEPS } from "@/lib/guide";
import { WEIGHTS } from "@/lib/scoring";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.onboarded ? "/feed" : "/onboarding");
  }
  const stats = await getLandingStats();

  return (
    <main className="relative overflow-x-clip">
      <ShaderBackground opacity={0.6} />
      <div aria-hidden className="grain pointer-events-none fixed inset-0 z-[1] overflow-hidden" />
      <LandingNav />

      {/* ------------------------------------------------------------ hero */}
      <section className="relative z-[2]">
        <div className="bg-grid bg-grid-fade absolute inset-x-0 top-0 h-[90vh]" />
        <div className="container relative grid min-h-dvh items-center gap-10 pb-16 pt-28 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-7">
            <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-iris animate-rise-in">
              <span className="h-px w-8 bg-iris" />
              01 &nbsp;·&nbsp; match
            </p>

            <h1
              className="mt-6 font-mono text-[clamp(2.4rem,5.4vw,5.1rem)] font-semibold leading-[1.02] tracking-[-0.025em] animate-rise-in"
              style={{ animationDelay: "80ms" }}
            >
              <span className="block whitespace-nowrap">Find the issue</span>
              <span className="block whitespace-nowrap">
                that <span className="text-iris-gradient">fits you.</span>
              </span>
              <span className="block whitespace-nowrap">Then ship it.</span>
            </h1>

            <p
              className="mt-7 max-w-[34rem] text-pretty text-lg leading-relaxed text-muted-foreground animate-rise-in"
              style={{ animationDelay: "160ms" }}
            >
              FirstFork scores real GitHub issues on six signals against your
              languages and level, then walks you through the pull request one
              copy-pasteable command at a time.
            </p>

            <div
              className="mt-9 flex flex-wrap items-center gap-3 animate-rise-in"
              style={{ animationDelay: "240ms" }}
            >
              <SignInButton />
              <Button asChild variant="ghost" size="lg" className="font-mono text-muted-foreground">
                <Link href="#scoring">
                  See the scoring
                  <ArrowDown className="size-4" />
                </Link>
              </Button>
            </div>

            <dl
              className={`mt-14 grid gap-6 border-t border-border/70 pt-6 animate-rise-in ${stats ? "max-w-xl grid-cols-2 sm:grid-cols-4" : "max-w-md grid-cols-3"}`}
              style={{ animationDelay: "320ms" }}
            >
              {stats && <Stat n={compact(stats.issues)} label="issues indexed" live />}
              <Stat n={String(Object.keys(WEIGHTS).length)} label="scoring signals" />
              <Stat n={String(GUIDE_STEPS.length)} label="guided steps" />
              <Stat n="0" label="GitHub calls per view" />
            </dl>
          </div>

          <div className="lg:col-span-5 lg:-mr-10 xl:-mr-20">
            <HeroScene />
          </div>
        </div>

        <p className="container flex items-center gap-2 pb-6 font-mono text-[11px] text-muted-foreground">
          <GithubMark className="size-3.5" />
          Read-only OAuth. We never ask for write access to your repos.
        </p>
      </section>

      <div className="relative z-[2]">
        <LogoMarquee />
      </div>

      <StoryChapter />

      {/* --------------------------------------------------------- scoring */}
      <section id="scoring" className="relative z-[2] scroll-mt-24">
        <div className="container py-28">
          <SectionIndex n="03" label="scoring" title="Six signals. One number you can argue with.">
            Every factor is normalised to 0–1 and combined with a fixed weight.
            The weights sum to one, so a card&apos;s score reads directly as a
            percentage, and the breakdown is shown on every card. Nothing is
            filtered out silently.
          </SectionIndex>
          <div className="mt-16">
            <ScoreAnatomy />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- bento */}
      <section className="relative z-[2] border-t border-border/70">
        <div className="container py-28">
          <SectionIndex n="04" label="what you get" title="Built for the first pull request, not the fiftieth.">
            The parts that trip people up are not the code. They are the forty
            minutes of setup and etiquette around it. Those are handled.
          </SectionIndex>
          <div className="mt-14">
            <Bento />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- guide */}
      <section className="relative z-[2] border-t border-border/70 bg-card/40">
        <div className="container grid gap-16 py-28 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <SectionIndex n="05" label="guide" title="Then it teaches you the rest.">
                Finding an issue is not what stops first-timers. It is the eight
                steps after. Save one and you get this checklist filled in with
                that repo&apos;s clone URL, that issue&apos;s number, and a branch
                name you can paste straight into your terminal.
              </SectionIndex>
              <div className="mt-8">
                <TerminalReplay />
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <Pipeline />
          </div>
        </div>
      </section>

      <ContributeBanner />

      {/* ----------------------------------------------------------- cta */}
      <section className="relative z-[2] border-t border-border/70">
        <div className="container py-28">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-10 sm:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 size-[380px] rounded-full bg-iris/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-16 size-[320px] rounded-full bg-neon/15 blur-3xl"
            />
            <div className="relative grid gap-8 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-iris">06 &nbsp;·&nbsp; start</p>
                <h2 className="mt-4 font-mono text-3xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                  Your first pull request
                  <br />
                  is already picked out.
                </h2>
              </div>
              <div className="flex flex-col items-start gap-3 lg:col-span-4 lg:items-end">
                <SignInButton />
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  what is a pull request?
                  <ArrowUpRight className="size-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-[2] border-t border-border/70">
        <div className="container flex flex-col gap-2 py-8 font-mono text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{BRAND.wordmark.lead}/{BRAND.wordmark.tail}</span>
          <span>Issue data from the GitHub API. Not affiliated with GitHub.</span>
        </div>
      </footer>
    </main>
  );
}

function Stat({ n, label, live }: { n: string; label: string; live?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-2 font-mono text-3xl font-semibold tabular-nums leading-none">
        {n}
        {live && <span className="size-1.5 rounded-full bg-neon animate-pulse" aria-label="live" />}
      </dt>
      <dd className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{label}</dd>
    </div>
  );
}

function compact(n: number) {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
}
