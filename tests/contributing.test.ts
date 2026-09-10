import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeContributing } from "../src/lib/contributing";

test("markdown links in headings are flattened to their text", () => {
  const md = [
    "# Contributing",
    "## [Getting help](https://example.com/help)",
    "Ask in the forum.",
    "## About the [dev-guide]",
    "The guide explains the compiler.",
    "",
    "[dev-guide]: https://example.com/guide",
  ].join("\n");

  const headings = summarizeContributing(md).sections.map((s) => s.heading);
  assert.ok(headings.includes("Getting help"), headings.join(" | "));
  assert.ok(headings.includes("About the dev-guide"), headings.join(" | "));
  for (const h of headings) {
    assert.ok(!h.includes("["), `bracket survived in: ${h}`);
    assert.ok(!h.includes("http"), `url survived in: ${h}`);
  }
});

test("a file with only a title yields an intro and no outline", () => {
  const md = [
    "# Contributing to React",
    "",
    "Want to contribute? Read the [contribution guide](https://example.com).",
  ].join("\n");

  const summary = summarizeContributing(md);
  assert.equal(summary.sections.length, 0, "a lone title is not an outline");
  assert.ok(summary.intro.startsWith("Want to contribute"));
  assert.ok(!summary.intro.includes("https://"), "links should be flattened");
});

test("guides without setup wording still get their own outline", () => {
  const md = [
    "# Contributing to Thing",
    "## Bug reports",
    "File them on the tracker.",
    "## Feature suggestions",
    "Open a discussion first.",
  ].join("\n");

  const headings = summarizeContributing(md).sections.map((s) => s.heading);
  assert.deepEqual(headings, ["Bug reports", "Feature suggestions"]);
});

test("how-to headings outrank a project's incidental ones", () => {
  const md = [
    "# Contributing",
    "## Our history",
    "Founded in 2011.",
    "## Development setup",
    "Run npm install.",
    "## Sponsors",
    "Thanks to our backers.",
    "## Running tests",
    "Run npm test.",
  ].join("\n");

  const headings = summarizeContributing(md).sections.map((s) => s.heading);
  assert.deepEqual(headings, ["Development setup", "Running tests"]);
});

test("badges and HTML chrome never leak into the intro", () => {
  const md = [
    "# Contributing",
    "",
    "[![build](https://img.shields.io/badge.svg)](https://ci.example.com)",
    '<img src="logo.png" />',
    "<!-- a comment -->",
    "",
    "Thanks for helping out with `the-project`.",
  ].join("\n");

  const intro = summarizeContributing(md).intro;
  assert.equal(intro, "Thanks for helping out with the-project.");
});

test("excerpts skip straight to the first line of prose", () => {
  const md = [
    "# Contributing",
    "## Development setup",
    "",
    "| os | supported |",
    "|----|-----------|",
    "- Install Node 20 first.",
  ].join("\n");

  const section = summarizeContributing(md).sections[0];
  assert.equal(section.heading, "Development setup");
  assert.equal(section.excerpt, "Install Node 20 first.");
});

test("at most eight sections come back", () => {
  const md = ["# Contributing"]
    .concat(
      Array.from({ length: 20 }, (_, i) => `## Setup part ${i}\nDo step ${i}.`),
    )
    .join("\n");
  assert.equal(summarizeContributing(md).sections.length, 8);
});

test("a file with no headings at all is handled", () => {
  const summary = summarizeContributing("Just a sentence, no structure.");
  assert.equal(summary.headingCount, 0);
  assert.equal(summary.sections.length, 0);
  assert.equal(summary.intro, "Just a sentence, no structure.");
});
