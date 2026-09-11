import { GitPullRequest, Sparkles, Terminal, Scale } from "lucide-react";
import { GithubMark } from "@/components/github-mark";
import { BRAND } from "@/lib/brand";

/**
 * The project is itself an open source project looking for contributors, which
 * is easy to miss when the whole page is about other people's repositories.
 * This says so on the site rather than only in the README, where nobody who
 * arrives from a link will ever look.
 */

const POINTS = [
  {
    icon: GitPullRequest,
    title: "No permission needed",
    body: "Pick an open issue, or send a pull request for something nobody has raised. There is no proposal to clear first.",
  },
  {
    icon: Sparkles,
    title: "Any feature is fair game",
    body: "If it fits the project and the code is sound, it gets merged. If it does not fit, you get a reason rather than silence.",
  },
  {
    icon: Terminal,
    title: "One command to run it",
    body: "npm run demo starts the whole app on seeded data. No database to provision, no keys, no accounts.",
  },
  {
    icon: Scale,
    title: "MIT, and drafts welcome",
    body: "Open a draft early and ask. A half-working branch with a question attached is a perfectly good thing to send.",
  },
];

export function ContributeBanner() {
  return (
    <section className="relative z-[2] border-t border-border/70">
      <div className="container py-24">
        <div className="relative overflow-hidden rounded-2xl border border-iris/25 bg-card/60 p-8 sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-40 size-[420px] rounded-full bg-iris/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -right-24 size-[360px] rounded-full bg-neon/12 blur-3xl"
          />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-neon/40 bg-neon/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-neon">
                Open to contributions
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                MIT licensed &nbsp;·&nbsp; issues labelled for newcomers
              </span>
            </div>

            <h2 className="mt-5 max-w-3xl font-mono text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl">
              This site is one of those repositories.
              <br />
              <span className="bg-gradient-to-r from-iris via-primary to-neon bg-clip-text text-transparent">
                Build something here.
              </span>
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {BRAND.name} is open source and actively looking for people to work on
              it. It is a reasonable place to make a first contribution, because
              making that easy is the entire point of the project.
            </p>

            <dl className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2">
              {POINTS.map((p) => (
                <div key={p.title} className="flex gap-3.5">
                  <p.icon className="mt-0.5 size-4 shrink-0 text-iris" aria-hidden />
                  <div className="min-w-0">
                    <dt className="font-mono text-sm font-semibold">{p.title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a
                href={`${BRAND.repo}/labels/good%20first%20issue`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 font-mono text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <GithubMark className="size-4" />
                Find a good first issue
              </a>
              <a
                href={`${BRAND.repo}/blob/main/CONTRIBUTING.md`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 font-mono text-xs text-muted-foreground transition-colors hover:border-iris/40 hover:text-foreground"
              >
                Read the contributing guide
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
