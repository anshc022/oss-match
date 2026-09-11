/**
 * One place the product's identity lives. Every title, social card, manifest
 * entry and structured-data block reads from here, so a rename is one edit
 * rather than a search across the app.
 */

export const BRAND = {
  /** Full name, as prose. */
  name: "FirstFork",
  /** Wordmark halves. The slash between them is drawn by the component. */
  wordmark: { lead: "first", tail: "fork" },
  domain: "firstfork.dev",
  tagline: "Your first fork, guided.",
  description:
    "FirstFork matches you to real open source issues by language, skill level and interest, then walks you through the whole contribution one command at a time.",
  /** Used for social cards, where there is room for a sentence but not a paragraph. */
  shortDescription:
    "Find an open source issue that actually fits you, then ship your first pull request.",
  /**
   * Canonical origin. Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every
   * deployment, so previews resolve their own absolute URLs instead of
   * pointing social crawlers at production.
   */
  url:
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://firstfork.dev"),
  repo: "https://github.com/anshc022/oss-match",
  /** Brand colours, duplicated from globals.css because manifests need hex. */
  color: { iris: "#7c5cff", cyan: "#22d3ee", dark: "#08060f", light: "#f7f5fd" },
} as const;

export const OG_SIZE = { width: 1200, height: 630 };
