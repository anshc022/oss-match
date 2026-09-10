#!/usr/bin/env node
/**
 * Rebuild the demo fixture from public GitHub data.
 *
 * `npm run demo` seeds an in-memory database from fixtures/demo-issues.json so
 * a contributor can run the app with no accounts and no secrets. That file goes
 * stale as issues get closed, so this regenerates it. Run it with the GitHub
 * CLI authenticated:
 *
 *   gh auth login
 *   node scripts/build-demo-fixtures.mjs
 *
 * Everything written here is public: repository names, issue titles, labels and
 * star counts. No tokens and no user data.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";

const run = promisify(execFile);

const LANGUAGES = ["TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "Ruby", "C++"];
const PER_LANGUAGE = 5;

async function gh(args) {
  const { stdout } = await run("gh", args, { maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(stdout);
}

/** ISO date `days` ago, for the freshness qualifier. */
function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

async function searchIssues(language) {
  const q = [
    'label:"good first issue"',
    `language:${language}`,
    "state:open",
    "is:issue",
    "no:assignee",
    "archived:false",
    `created:>${isoDaysAgo(180)}`,
  ].join(" ");
  const data = await gh([
    "api", "-X", "GET", "search/issues",
    "-f", `q=${q}`,
    "-f", "advanced_search=true",
    "-f", "sort=updated",
    "-f", "order=desc",
    "-F", `per_page=${PER_LANGUAGE}`,
  ]);
  return data.items ?? [];
}

async function repoSignals(fullName) {
  const r = await gh(["api", `repos/${fullName}`]);
  // Community files decide the "welcoming" factor in scoring.
  let profile = {};
  try {
    profile = await gh(["api", `repos/${fullName}/community/profile`]);
  } catch {
    /* Not every repository exposes one; the scorer treats that as absent. */
  }
  return {
    fullName: r.full_name,
    language: r.language ?? "",
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    openIssues: r.open_issues_count ?? 0,
    pushedAt: r.pushed_at,
    defaultBranch: r.default_branch ?? "main",
    cloneUrl: r.clone_url,
    topics: r.topics ?? [],
    archived: Boolean(r.archived),
    hasContributing: Boolean(profile?.files?.contributing),
    hasCodeOfConduct: Boolean(profile?.files?.code_of_conduct),
    hasCi: true,
  };
}

const issues = [];
const repos = new Map();

for (const language of LANGUAGES) {
  process.stdout.write(`searching ${language}… `);
  const items = await searchIssues(language);
  console.log(`${items.length} issues`);
  for (const item of items) {
    const fullName = item.repository_url.replace("https://api.github.com/repos/", "");
    if (!repos.has(fullName)) repos.set(fullName, await repoSignals(fullName));
    issues.push({
      id: item.id,
      number: item.number,
      title: item.title,
      body: (item.body ?? "").slice(0, 1200),
      htmlUrl: item.html_url,
      repoFullName: fullName,
      repoUrl: `https://github.com/${fullName}`,
      labels: item.labels.map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean),
      comments: item.comments ?? 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      hasLinkedPr: false,
      assigned: false,
      language,
    });
  }
}

const out = {
  note: "Public GitHub data, used to seed the zero-config demo. Rebuild with scripts/build-demo-fixtures.mjs.",
  generatedAt: new Date().toISOString(),
  issues,
  repos: Object.fromEntries(repos),
};

writeFileSync("fixtures/demo-issues.json", JSON.stringify(out, null, 1) + "\n");
console.log(`\nwrote ${issues.length} issues across ${repos.size} repositories`);
