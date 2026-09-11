import { Target } from "lucide-react";
import {
  siGithub, siReddit, siDiscord, siX, siGoogle, siStackoverflow, siYoutube, siDevdotto,
  type SimpleIcon,
} from "simple-icons";
import { BrandIcon } from "@/components/landing/brand-icon";
import { SectionIndex } from "@/components/landing/section-index";
import { Character } from "@/components/landing/story/voxel-figure";
import { DrawPath, Note, Reveal, Scribble, SketchDefs } from "@/components/landing/story/sketch";
import type { Role } from "@/components/landing/story/characters";
import { BRAND } from "@/lib/brand";

/**
 * The story, told as a sketch taped onto the page: on the left, what finding
 * a first issue usually looks like; on the right, what happens here instead.
 *
 * The paper is always cream, in both themes. It is a drawing, and a drawing
 * keeps its own colours the way a photograph would.
 */

const HUNTING_GROUNDS: Array<{ icon: SimpleIcon; label: string }> = [
  { icon: siGithub, label: "GitHub search" },
  { icon: siReddit, label: "Reddit" },
  { icon: siDiscord, label: "Discord" },
  { icon: siX, label: "X" },
  { icon: siGoogle, label: "Google" },
  { icon: siStackoverflow, label: "Stack Overflow" },
  { icon: siYoutube, label: "YouTube" },
  { icon: siDevdotto, label: "dev.to" },
];

const SPECIALISTS: Array<{ role: Role; name: string; does: string }> = [
  { role: "crown", name: "Match score", does: "scores it" },
  { role: "beret", name: "Deep Dive", does: "maps the repo" },
  { role: "headset", name: "Mentor", does: "finds who to ask" },
  { role: "cap", name: "Skill graph", does: "reads your history" },
  { role: "builder", name: "Guide", does: "walks the PR" },
  { role: "hood", name: "Fetcher", does: "keeps it fresh" },
];

export function StoryChapter() {
  return (
    <section id="story" className="relative z-[2] scroll-mt-24">
      <div className="container py-28">
        <SectionIndex n="02" label="the story" title="Two ways this goes.">
          Every first contribution starts in a search box. This is the difference
          between doing that alone and doing it here.
        </SectionIndex>

        <Paper className="mt-14">
          <div className="grid divide-y divide-dashed divide-[var(--ink-line)] lg:grid-cols-[1fr_1.15fr] lg:divide-x lg:divide-y-0">
            <Before />
            <After />
          </div>
        </Paper>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- paper */

function Paper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`paper relative rounded-2xl ${className ?? ""}`}
      style={
        {
          "--paper": "#f4eee2",
          "--ink": "#2a2438",
          "--ink-soft": "#645b7a",
          "--ink-line": "#b7ad9e",
          color: "var(--ink)",
        } as React.CSSProperties
      }
    >
      <Tape className="-top-3 left-8 -rotate-3" />
      <Tape className="-top-3 right-10 rotate-2" />
      {children}
    </div>
  );
}

function Tape({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 h-6 w-24 bg-[#fff1bd]/75 shadow-[0_1px_2px_rgba(0,0,0,.15)] ${className}`}
      style={{ backdropFilter: "blur(1px)" }}
    />
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ink-soft)]">
      {children}
    </p>
  );
}

/* --------------------------------------------------------------- before */

function Before() {
  return (
    <div className="p-6 sm:p-10">
      <PanelTitle>The usual way</PanelTitle>

      <div className="relative mt-4 h-[260px] sm:h-[270px]">
        <Note className="absolute left-0 top-0 max-w-[8rem] sm:max-w-[9.5rem]" tilt={-7}>
          Tab 47 of &ldquo;good first issue&rdquo;&hellip;
        </Note>
        <svg aria-hidden viewBox="0 0 64 64" className="absolute left-[7.2rem] top-9 h-14 w-14 text-[var(--ink)] sm:left-[8.6rem]">
          <SketchDefs />
          <DrawPath d="M4 4 C 22 6, 36 18, 44 52" arrow delay={0.5} />
        </svg>

        <Reveal from="scale" delay={0.1} className="absolute bottom-0 left-2 sm:left-8">
          <Character role="newcomer" desk unit={7.4} title="A developer at a desk, buried in browser tabs" />
        </Reveal>

        <Scribble className="absolute right-0 top-0 w-[118px] text-[var(--ink)] sm:right-2 sm:w-[150px]" delay={0.6} />
        <Note className="absolute right-0 top-[54%] max-w-[7.5rem] text-right sm:max-w-[9rem]" tilt={4} delay={0.7}>
          Closed in 2021.
          <br />
          Already claimed.
          <br />
          Not actually easy.
        </Note>
      </div>

      <ul className="mt-6 grid grid-cols-4 gap-2.5">
        {HUNTING_GROUNDS.map((h, i) => (
          <Reveal key={h.label} delay={0.05 * i} from="scale">
            <li className="flex h-full flex-col items-center gap-2 rounded-xl bg-white/85 px-2 py-3 shadow-[0_1px_2px_rgba(0,0,0,.08)] ring-1 ring-black/5">
              <BrandIcon icon={h.icon} brand className="size-6 sm:size-7" />
              <span className="text-center font-sans text-[10.5px] font-medium leading-tight text-[var(--ink)] sm:text-[11px]">
                {h.label}
              </span>
            </li>
          </Reveal>
        ))}
      </ul>

      <p className="mt-7 text-center font-sans text-[15px] leading-snug text-[var(--ink)]">
        Thousands of issues.
        <br />
        <span className="text-[var(--ink-soft)]">But you still have to find the one that fits.</span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- after */

function After() {
  return (
    <div className="p-6 sm:p-10">
      <PanelTitle>The {BRAND.name} way</PanelTitle>

      <div className="mt-4 flex flex-col items-center">
        {/* The person, and the one thing they bring. */}
        <div className="relative">
          <Reveal from="scale" delay={0.1}>
            <Character role="newcomer" unit={6} title="The same developer" />
          </Reveal>
          <Note className="absolute -right-[7.6rem] top-1 w-[7rem] text-left sm:-right-[8.5rem]" tilt={6} delay={0.4}>
            Just your profile.
          </Note>
          <svg aria-hidden viewBox="0 0 48 40" className="absolute -right-[3.4rem] top-7 h-10 w-12 text-[var(--ink)]">
            <SketchDefs />
            <DrawPath d="M44 4 C 30 8, 16 12, 6 30" arrow delay={0.6} />
          </svg>
        </div>

        <Reveal delay={0.2} className="mt-1">
          <div className="flex items-center gap-2.5 rounded-xl bg-[#7c5cff] px-5 py-2.5 font-mono text-[13px] font-bold tracking-[0.18em] text-white shadow-[0_5px_0_#5b3fd6]">
            <Target className="size-4" aria-hidden />
            ONE PROFILE
          </div>
        </Reveal>

        <Connector />

        {/* The guide. */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <Reveal from="scale" delay={0.35}>
            <Character role="guide" unit={7.2} title="FirstFork, drawn as a wizard at a laptop" />
          </Reveal>
          <Reveal delay={0.45} className="text-center sm:text-left">
            <p className="font-mono text-sm font-bold tracking-wide text-[var(--ink)]">{BRAND.name.toUpperCase()}</p>
            <p className="mt-1 text-[15px] leading-snug text-[var(--ink-soft)]">
              Scores. Maps. Introduces.
              <br />
              Guides. Keeps it fresh.
            </p>
          </Reveal>
        </div>

        {/* The fan-out. */}
        <div className="relative mt-2 w-full">
          <svg
            aria-hidden
            viewBox="0 0 600 44"
            preserveAspectRatio="none"
            className="hidden h-11 w-full text-[var(--ink-line)] sm:block"
          >
            <DrawPath d="M300 0 V22 M50 22 H550 M50 22 V44 M150 22 V44 M250 22 V44 M350 22 V44 M450 22 V44 M550 22 V44" delay={0.6} duration={1.1} />
          </svg>
          <div className="mx-auto h-6 w-px bg-[var(--ink-line)] sm:hidden" />

          <ul className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-6">
            {SPECIALISTS.map((s, i) => (
              <li key={s.name} className="flex flex-col items-center text-center">
                <Reveal from="scale" delay={0.7 + i * 0.07}>
                  <Character role={s.role} unit={4.1} title={`${s.name}: ${s.does}`} />
                </Reveal>
                <span className="mt-1 font-mono text-[10.5px] font-semibold leading-tight text-[var(--ink)]">{s.name}</span>
                <span className="text-[10px] leading-tight text-[var(--ink-soft)]">{s.does}</span>
              </li>
            ))}
          </ul>

          <Note className="absolute -right-1 -top-3 hidden w-[6.5rem] text-right lg:block" tilt={5} delay={1}>
            A full pipeline.
          </Note>
          <svg aria-hidden viewBox="0 0 40 60" className="absolute right-2 top-7 hidden h-14 w-10 text-[var(--ink)] lg:block">
            <SketchDefs />
            <DrawPath d="M30 4 C 34 22, 30 40, 14 54" arrow delay={1.1} />
          </svg>
        </div>

        <p className="mt-7 text-center font-sans text-[15px] leading-snug text-[var(--ink)]">
          <span className="font-mono text-[13px] font-bold tracking-wide">SIX SPECIALISTS ON EVERY MATCH</span>
          <br />
          <span className="text-[var(--ink-soft)]">Score. Map. Introduce. Read. Guide. Refresh.</span>
        </p>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <svg aria-hidden viewBox="0 0 16 36" className="my-1 h-9 w-4 text-[var(--ink)]">
      <SketchDefs />
      <DrawPath d="M8 2 V30" arrow delay={0.3} duration={0.5} />
    </svg>
  );
}
