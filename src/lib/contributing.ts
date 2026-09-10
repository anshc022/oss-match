/**
 * Extractive summary of a repo's CONTRIBUTING.md: the headings a first-timer
 * actually needs (setup, tests, style, PR process) plus the opening paragraph.
 *
 * Extractive on purpose. No model call, and it never invents a rule the
 * project did not write. Pure and dependency-free so it stays testable
 * without pulling in the GitHub client.
 */

export type ContributingSections = {
  intro: string;
  sections: { heading: string; excerpt: string }[];
  headingCount: number;
};

/** Headings that answer "what do I actually have to do", ranked by usefulness. */
const PRIORITY_HEADING =
  /(setup|set up|install|prerequisite|environment|getting started|develop|build|run|test|lint|style|format|convention|commit|pull request|\bpr\b|submit|review|workflow|guideline|before you|first)/i;

/** Headings that are about the project, not about contributing to it. */
const NOISE_HEADING =
  /(license|sponsor|funding|thanks|acknowledg|history|roadmap|changelog|trivia|logo|credits)/i;

export function summarizeContributing(markdown: string): ContributingSections {
  const lines = markdown.split("\n");

  const headings = lines
    .map((line, i) => ({ raw: line.trim(), i }))
    .filter(({ raw }) => /^#{1,3}\s+/.test(raw))
    .map(({ raw, i }) => ({
      text: cleanHeading(raw.replace(/^#{1,3}\s+/, "")),
      i,
    }))
    .filter((h) => h.text.length > 0);

  // Skip the document title: it is always "Contributing to X" and says nothing.
  // A file with nothing but a title has no outline worth showing; the intro
  // carries it instead.
  const body = headings.slice(1);

  const useful = body.filter((h) => !NOISE_HEADING.test(h.text));
  const priority = useful.filter((h) => PRIORITY_HEADING.test(h.text));

  // Prefer the how-to headings; if a guide does not use those words, fall back
  // to its own outline rather than showing the reader nothing.
  const chosen = (priority.length > 0 ? priority : useful).slice(0, 8);

  const sections = chosen.map((h) => ({
    heading: h.text,
    excerpt: excerptAfter(lines, h.i),
  }));

  return { intro: introOf(lines), sections, headingCount: headings.length };
}

/** `## [Getting help](https://…)` -> `Getting help`; drops trailing anchors. */
function cleanHeading(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Reference-style links: `[rustc-dev-guide]` with the target defined below.
    .replace(/\[([^\]]+)\](?!\()/g, "$1")
    .replace(/<a\s[^>]*>|<\/a>/gi, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s*\{#[\w-]+\}\s*$/, "")
    .replace(/:+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** First real prose line under a heading, flattened to plain text. */
function excerptAfter(lines: string[], headingIndex: number) {
  const body = lines
    .slice(headingIndex + 1, headingIndex + 10)
    .find((l) => l.trim() && !/^#{1,3}\s+/.test(l.trim()) && !isChrome(l));
  if (!body) return "";
  return flatten(body).slice(0, 180);
}

/** The opening paragraph, skipping badges, headings and blockquotes. */
function introOf(lines: string[]) {
  const prose: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || isChrome(t) || /^#{1,6}\s/.test(t)) {
      if (prose.length > 0) break;
      continue;
    }
    prose.push(flatten(t));
    if (prose.join(" ").length > 300) break;
  }
  return prose.join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
}

/** Badge rows, HTML comments, tables and image-only lines carry no meaning here. */
function isChrome(line: string) {
  const t = line.trim();
  return (
    /^\[!\[/.test(t) ||
    /^!\[/.test(t) ||
    /^<!--/.test(t) ||
    /^</.test(t) ||
    /^\|/.test(t) ||
    /^[-=*_]{3,}$/.test(t)
  );
}

/** Markdown -> readable one-liner, keeping link text and inline code contents. */
function flatten(text: string) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_>#]/g, "")
    .replace(/^\s*[-+*]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
