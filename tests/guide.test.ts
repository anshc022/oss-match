import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GUIDE_STEPS,
  branchNameFor,
  buildGuideSteps,
  type GuideContext,
} from "../src/lib/guide";
import { summarizeContributing } from "../src/lib/contributing";

const ctx: GuideContext = {
  repoName: "vercel/next.js",
  repoUrl: "https://github.com/vercel/next.js",
  cloneUrl: "https://github.com/vercel/next.js.git",
  defaultBranch: "canary",
  issueNumber: 51234,
  issueTitle: "[BUG] Image component drops alt text on rerender",
  username: "octocat",
  hasContributing: true,
  contributingUrl: "https://github.com/vercel/next.js/blob/canary/contributing.md",
};

test("the guide has exactly eight steps in order", () => {
  assert.equal(GUIDE_STEPS.length, 8);
  assert.deepEqual(
    GUIDE_STEPS.map((s) => s.id),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
});

test("branch names embed the issue number and stay shell-safe", () => {
  const branch = branchNameFor(ctx);
  assert.ok(branch.includes("51234"), branch);
  assert.match(branch, /^[a-z0-9/-]+$/, `unsafe branch name: ${branch}`);
  assert.ok(branch.length < 60, "branch name should stay short");
});

test("every step resolves to at least one block", () => {
  const steps = buildGuideSteps(ctx);
  assert.equal(steps.length, 8);
  for (const step of steps) {
    assert.ok(step.blocks.length > 0, `step ${step.id} had no content`);
  }
});

test("clone step uses the contributor's fork, not the upstream repo", () => {
  const steps = buildGuideSteps(ctx);
  const clone = steps[1].blocks.find(
    (b) => b.kind === "command" && b.code.includes("git clone"),
  );
  assert.ok(clone && clone.kind === "command");
  assert.ok(
    clone.code.includes("github.com/octocat/next.js.git"),
    `cloned the wrong remote: ${clone.code}`,
  );

  const upstream = steps[1].blocks.find(
    (b) => b.kind === "command" && b.code.includes("git remote add upstream"),
  );
  assert.ok(upstream && upstream.kind === "command");
  assert.ok(upstream.code.includes("vercel/next.js.git"));
});

test("branch step branches off the repo's actual default branch", () => {
  const steps = buildGuideSteps(ctx);
  const cmd = steps[3].blocks.find((b) => b.kind === "command");
  assert.ok(cmd && cmd.kind === "command");
  assert.ok(cmd.code.includes("canary"), `expected canary, got: ${cmd.code}`);
  assert.ok(!cmd.code.includes("git checkout main"));
});

test("step 3 changes shape when the repo has no CONTRIBUTING.md", () => {
  const withGuide = buildGuideSteps(ctx)[2];
  const without = buildGuideSteps({ ...ctx, hasContributing: false })[2];

  const hasContribLink = withGuide.blocks.some(
    (b) => b.kind === "link" && b.label.includes("CONTRIBUTING"),
  );
  const fallsBackToReadme = without.blocks.some(
    (b) => b.kind === "link" && b.label.includes("README"),
  );
  assert.ok(hasContribLink, "should link the real contributing guide");
  assert.ok(fallsBackToReadme, "should fall back to the README");
});

test("PR template closes the issue and strips the title's bug tag", () => {
  const steps = buildGuideSteps(ctx);
  const description = steps[6].blocks.find(
    (b) => b.kind === "template" && b.label === "PR description",
  );
  assert.ok(description && description.kind === "template");
  assert.ok(description.code.includes("Fixes #51234"));

  const title = steps[6].blocks.find(
    (b) => b.kind === "template" && b.label === "PR title",
  );
  assert.ok(title && title.kind === "template");
  assert.ok(!title.code.includes("[BUG]"), `tag not stripped: ${title.code}`);
  // Conventional-commit style: the subject is downcased after the type prefix.
  assert.ok(title.code.startsWith("fix: "), title.code);
  assert.ok(title.code.toLowerCase().includes("image component drops alt text"), title.code);
});

test("push step pushes the same branch the branch step created", () => {
  const steps = buildGuideSteps(ctx);
  const branch = branchNameFor(ctx);
  const push = steps[6].blocks.find(
    (b) => b.kind === "command" && b.code.includes("git push"),
  );
  assert.ok(push && push.kind === "command");
  assert.ok(push.code.includes(branch), `${push.code} should push ${branch}`);
});

test("a title of only punctuation still yields a usable branch", () => {
  const branch = branchNameFor({ issueNumber: 7, issueTitle: "!!! ???" });
  assert.equal(branch, "fix/7");
});

test("summarizeContributing pulls out the sections a newcomer needs", () => {
  const md = [
    "# Contributing to Thing",
    "",
    "Thanks for your interest in Thing. This document explains how to get set up.",
    "",
    "## Development setup",
    "Run `pnpm install` then `pnpm dev` to start the local server.",
    "",
    "## Running tests",
    "Use `pnpm test` before opening a pull request.",
    "",
    "## Unrelated trivia",
    "Our logo was drawn in 2011.",
  ].join("\n");

  const summary = summarizeContributing(md);
  const headings = summary.sections.map((s) => s.heading);
  assert.ok(headings.includes("Development setup"), headings.join(", "));
  assert.ok(headings.includes("Running tests"));
  assert.ok(!headings.includes("Unrelated trivia"), "should skip irrelevant sections");
  assert.ok(summary.intro.includes("Thanks for your interest"));
  assert.ok(summary.sections[0].excerpt.length > 0, "sections should carry an excerpt");
});

test("summarizeContributing survives an empty file", () => {
  const summary = summarizeContributing("");
  assert.equal(summary.sections.length, 0);
  assert.equal(summary.intro, "");
});
