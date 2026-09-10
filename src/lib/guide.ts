/**
 * The eight-step first contribution walkthrough. Step metadata is static so it
 * can be imported anywhere (including the Mongoose model, for progress
 * validation); `buildGuideSteps` resolves it against a specific repo + issue so
 * every command on screen is copy-pasteable as-is.
 */

export type GuideBlock =
  | { kind: "text"; body: string }
  | { kind: "command"; label?: string; code: string }
  | { kind: "template"; label: string; code: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "screenshot"; caption: string }
  | { kind: "tip"; body: string };

export type GuideStepMeta = {
  id: number;
  title: string;
  blurb: string;
};

export type GuideStep = GuideStepMeta & { blocks: GuideBlock[] };

export const GUIDE_STEPS: GuideStepMeta[] = [
  { id: 1, title: "Fork the repo", blurb: "Make your own copy on GitHub." },
  { id: 2, title: "Clone it locally", blurb: "Pull your fork down to your machine." },
  { id: 3, title: "Read CONTRIBUTING.md", blurb: "Every project has house rules. Skim them first." },
  { id: 4, title: "Create a branch", blurb: "Never work on main. Branch per issue." },
  { id: 5, title: "Make your change", blurb: "The actual work. Small and focused wins." },
  { id: 6, title: "Commit with a good message", blurb: "Explain the why, not just the what." },
  { id: 7, title: "Push and open a PR", blurb: "Send it, with a description reviewers can act on." },
  { id: 8, title: "Respond to review", blurb: "Feedback is normal. Here is how to handle it." },
];

export type GuideContext = {
  /** owner/repo */
  repoName: string;
  repoUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  issueNumber: number;
  issueTitle: string;
  /** The contributor's GitHub login, used for the fork remote URL. */
  username: string;
  hasContributing?: boolean;
  contributingUrl?: string;
};

/** `fix/1234-add-dark-mode-toggle` — readable, and links back to the issue. */
export function branchNameFor(ctx: Pick<GuideContext, "issueNumber" | "issueTitle">) {
  const slug = ctx.issueTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 6)
    .join("-");
  return `fix/${ctx.issueNumber}${slug ? `-${slug}` : ""}`;
}

export function buildGuideSteps(ctx: GuideContext): GuideStep[] {
  const repo = ctx.repoName.split("/")[1] ?? ctx.repoName;
  const branch = branchNameFor(ctx);
  const forkUrl = `https://github.com/${ctx.username}/${repo}.git`;

  const byId: Record<number, GuideBlock[]> = {
    1: [
      {
        kind: "text",
        body: `Open ${ctx.repoName} on GitHub and press the Fork button in the top-right corner. Keep the default settings and confirm. You now have your own copy at github.com/${ctx.username}/${repo}.`,
      },
      { kind: "link", label: `Fork ${ctx.repoName}`, href: `${ctx.repoUrl}/fork` },
      { kind: "screenshot", caption: "The Fork button sits in the top-right row, next to Watch and Star." },
      {
        kind: "tip",
        body: "Forking is not the same as starring. A star bookmarks the repo; a fork gives you a copy you can push to.",
      },
    ],
    2: [
      { kind: "text", body: "Clone your fork (not the original), then add the original as a second remote called upstream so you can pull in other people's changes later." },
      { kind: "command", label: "Clone your fork", code: `git clone ${forkUrl}\ncd ${repo}` },
      { kind: "command", label: "Track the original repo", code: `git remote add upstream ${ctx.cloneUrl || `${ctx.repoUrl}.git`}\ngit remote -v` },
      { kind: "tip", body: "`git remote -v` should list origin (your fork) and upstream (the original). If origin points at the original repo, you cloned the wrong URL." },
    ],
    3: ctx.hasContributing
      ? [
          { kind: "text", body: `${ctx.repoName} ships a CONTRIBUTING.md. Read it before writing code: it usually covers how to run the test suite, the commit message format, and whether maintainers want an issue claimed first.` },
          { kind: "link", label: "Open CONTRIBUTING.md", href: ctx.contributingUrl ?? `${ctx.repoUrl}/blob/${ctx.defaultBranch}/CONTRIBUTING.md` },
          { kind: "tip", body: "Look specifically for a setup section and a tests section. Those two decide whether your PR passes CI on the first try." },
        ]
      : [
          { kind: "text", body: `${ctx.repoName} has no CONTRIBUTING.md at the repo root. Fall back to the README's development section, and check whether recent merged PRs follow a visible convention.` },
          { kind: "link", label: "Read the README", href: ctx.repoUrl },
          { kind: "link", label: "Browse recent merged PRs", href: `${ctx.repoUrl}/pulls?q=is%3Apr+is%3Amerged` },
          { kind: "tip", body: "No contributing guide is a mild yellow flag. Comment on the issue asking if it is still open before you sink hours into it." },
        ],
    4: [
      { kind: "text", body: `Branch off ${ctx.defaultBranch}. One branch per issue keeps your PR reviewable and lets you work on something else without losing this.` },
      { kind: "command", label: "Create and switch to your branch", code: `git checkout ${ctx.defaultBranch}\ngit pull upstream ${ctx.defaultBranch}\ngit checkout -b ${branch}` },
      { kind: "tip", body: "Pulling from upstream first means you branch off current code, not whatever your fork had when you created it." },
    ],
    5: [
      { kind: "text", body: `Fix issue #${ctx.issueNumber}: ${ctx.issueTitle}` },
      { kind: "text", body: "Change as little as possible. Reviewers reject large diffs that mix a fix with unrelated reformatting. Do not run a formatter across the whole repo." },
      { kind: "command", label: "Check what you changed before committing", code: `git status\ngit diff` },
      { kind: "link", label: `Re-read issue #${ctx.issueNumber}`, href: `${ctx.repoUrl}/issues/${ctx.issueNumber}` },
      { kind: "tip", body: "Run the project's test suite locally now, not after opening the PR. A red CI check is the most common reason a first PR stalls." },
    ],
    6: [
      { kind: "text", body: "Stage only the files you meant to change, then write a message whose first line finishes the sentence \"If applied, this commit will...\"." },
      { kind: "command", label: "Stage and commit", code: `git add <the files you changed>\ngit commit` },
      {
        kind: "template",
        label: "Commit message template",
        code: `fix: ${lowerFirst(stripPrefix(ctx.issueTitle))}\n\nExplain what was wrong and why this change fixes it. Wrap at\n72 characters. Mention anything a reviewer would otherwise\nhave to ask about.\n\nRefs #${ctx.issueNumber}`,
      },
      { kind: "tip", body: "Avoid `git add .` — it sweeps up editor files and stray debug output. Name the files instead." },
    ],
    7: [
      { kind: "command", label: "Push your branch to your fork", code: `git push -u origin ${branch}` },
      { kind: "text", body: "GitHub prints a Compare & pull request link in the push output. Open it, or use the button that appears on the repo page." },
      { kind: "link", label: "Open a pull request", href: `${ctx.repoUrl}/compare/${ctx.defaultBranch}...${ctx.username}:${branch}?expand=1` },
      { kind: "template", label: "PR title", code: `fix: ${lowerFirst(stripPrefix(ctx.issueTitle))}` },
      {
        kind: "template",
        label: "PR description",
        code: `## What this does\n\nFixes #${ctx.issueNumber}.\n\nDescribe the change in two or three sentences.\n\n## How I tested it\n\n- [ ] Ran the existing test suite locally\n- [ ] Added or updated a test covering this change\n- [ ] Checked the behaviour by hand\n\n## Notes for the reviewer\n\nAnything you were unsure about, or decisions you would like a second\nopinion on.`,
      },
      { kind: "tip", body: `Writing "Fixes #${ctx.issueNumber}" in the description makes GitHub close the issue automatically when the PR merges.` },
    ],
    8: [
      { kind: "text", body: "Review comments are not rejection. Most first PRs get changes requested, including from experienced contributors." },
      { kind: "text", body: "Push follow-up commits to the same branch. The PR updates itself. Do not open a new one." },
      { kind: "command", label: "Amend after feedback", code: `git add <files>\ngit commit -m "review: address feedback on <thing>"\ngit push` },
      { kind: "command", label: "If the maintainer asks you to rebase", code: `git fetch upstream\ngit rebase upstream/${ctx.defaultBranch}\ngit push --force-with-lease` },
      { kind: "tip", body: "Reply to each comment, even if only to say you have made the change. Silence reads as an abandoned PR, and abandoned PRs get closed." },
      { kind: "link", label: `Watch your PR on ${ctx.repoName}`, href: `${ctx.repoUrl}/pulls` },
    ],
  };

  return GUIDE_STEPS.map((step) => ({ ...step, blocks: byId[step.id] ?? [] }));
}

/** Issue titles often arrive as "[BUG] Thing is broken" — drop the tag. */
function stripPrefix(title: string) {
  return title.replace(/^\s*[\[(][^\])]*[\])]\s*/, "").trim() || title.trim();
}

function lowerFirst(s: string) {
  if (!s) return s;
  // Leave acronyms and identifiers alone: only downcase a plain capitalised word.
  if (/^[A-Z]{2,}/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
