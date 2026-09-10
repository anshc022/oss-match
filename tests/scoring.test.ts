import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WEIGHTS,
  rankIssues,
  scoreContention,
  scoreDifficulty,
  scoreFreshness,
  scoreIssue,
  scoreLanguage,
  scoreRepoHealth,
  scoreWelcoming,
  type ScoreProfile,
} from "../src/lib/scoring";
import type { CandidateIssue, RepoSignals } from "../src/lib/github";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function issue(overrides: Partial<CandidateIssue> = {}): CandidateIssue {
  return {
    id: 1,
    number: 42,
    title: "Fix the thing",
    body: "",
    htmlUrl: "https://github.com/acme/tool/issues/42",
    repoFullName: "acme/tool",
    repoUrl: "https://github.com/acme/tool",
    labels: ["good first issue"],
    comments: 0,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    hasLinkedPr: false,
    assigned: false,
    language: "",
    ...overrides,
  };
}

function repo(overrides: Partial<RepoSignals> = {}): RepoSignals {
  return {
    fullName: "acme/tool",
    etag: "",
    stars: 1200,
    forks: 180,
    openIssues: 40,
    pushedAt: new Date(Date.now() - 2 * 86_400_000),
    language: "TypeScript",
    topics: ["react", "web"],
    defaultBranch: "main",
    cloneUrl: "https://github.com/acme/tool.git",
    hasContributing: true,
    contributingPath: "",
    hasCodeOfConduct: true,
    hasCi: true,
    archived: false,
    fetchedAt: new Date(),
    ...overrides,
  };
}

const profile: ScoreProfile = {
  languages: ["TypeScript", "Python"],
  interests: ["web"],
  skillLevel: "beginner",
};

test("weights sum to 1 so the score reads as a percentage", () => {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights summed to ${total}`);
});

test("every factor stays inside 0-1", () => {
  const cases: Array<[string, number]> = [
    ["language", scoreLanguage(issue(), repo(), profile)],
    ["repoHealth", scoreRepoHealth(repo({ stars: 500_000, forks: 90_000 }))],
    ["freshness", scoreFreshness(issue({ createdAt: daysAgo(0), updatedAt: daysAgo(0) }))],
    ["contention", scoreContention(issue({ comments: 0 }))],
    ["difficulty", scoreDifficulty(issue(), "beginner")],
    ["welcoming", scoreWelcoming(repo(), issue({ body: "x".repeat(400) }))],
  ];
  for (const [name, value] of cases) {
    assert.ok(value >= 0 && value <= 1, `${name} was ${value}`);
  }
});

test("exact language match beats an unknown language", () => {
  const known = scoreLanguage(issue(), repo({ language: "TypeScript" }), profile);
  const unknown = scoreLanguage(issue(), repo({ language: "Haskell" }), profile);
  assert.ok(known > 0.9, `known scored ${known}`);
  assert.ok(unknown < 0.1, `unknown scored ${unknown}`);
});

test("adjacent languages get partial credit", () => {
  const adjacent = scoreLanguage(issue(), repo({ language: "JavaScript" }), profile);
  const unrelated = scoreLanguage(issue(), repo({ language: "Fortran" }), profile);
  assert.ok(adjacent > unrelated, "JavaScript should beat Fortran for a TS dev");
  assert.ok(adjacent < 0.9, "adjacent should not match an exact hit");
});

test("archived repos score zero health regardless of stars", () => {
  assert.equal(scoreRepoHealth(repo({ archived: true, stars: 90_000 })), 0);
});

test("a live small repo beats a dead popular one", () => {
  const live = scoreRepoHealth(repo({ stars: 200, forks: 20, pushedAt: new Date() }));
  const dead = scoreRepoHealth(
    repo({ stars: 40_000, forks: 8_000, pushedAt: new Date(Date.now() - 800 * 86_400_000) }),
  );
  assert.ok(live > dead, `live ${live} should beat dead ${dead}`);
});

test("freshness decays with age and floors out", () => {
  const fresh = scoreFreshness(issue({ createdAt: daysAgo(2), updatedAt: daysAgo(2) }));
  const mid = scoreFreshness(issue({ createdAt: daysAgo(60), updatedAt: daysAgo(60) }));
  const stale = scoreFreshness(issue({ createdAt: daysAgo(900), updatedAt: daysAgo(900) }));
  assert.ok(fresh > mid && mid > stale, `${fresh} > ${mid} > ${stale}`);
  assert.ok(stale > 0, "stale should floor above zero, not vanish");
});

test("recent activity partially revives an old issue", () => {
  const cold = scoreFreshness(issue({ createdAt: daysAgo(200), updatedAt: daysAgo(200) }));
  const revived = scoreFreshness(issue({ createdAt: daysAgo(200), updatedAt: daysAgo(3) }));
  assert.ok(revived > cold);
});

test("contention drops as comments pile up", () => {
  const quiet = scoreContention(issue({ comments: 0 }));
  const busy = scoreContention(issue({ comments: 8 }));
  const swarmed = scoreContention(issue({ comments: 40 }));
  assert.equal(quiet, 1);
  assert.ok(quiet > busy && busy > swarmed);
});

test("an assigned issue is fully discounted", () => {
  assert.equal(scoreContention(issue({ assigned: true, comments: 0 })), 0);
});

test("difficulty never filters, only reweights", () => {
  const gfi = issue({ labels: ["good first issue"] });
  const hard = issue({ labels: ["refactor", "performance"] });

  // An advanced user still sees good-first-issues, just ranked lower.
  const advOnGfi = scoreDifficulty(gfi, "advanced");
  assert.ok(advOnGfi > 0, "advanced users must still see first issues");
  assert.ok(advOnGfi < scoreDifficulty(hard, "advanced"));

  // A beginner sees help-wanted work, not only the curated first-issue pool.
  const begOnHelp = scoreDifficulty(issue({ labels: ["help wanted"] }), "beginner");
  assert.ok(begOnHelp > 0.4, `beginner on help wanted scored ${begOnHelp}`);
  assert.ok(begOnHelp < scoreDifficulty(gfi, "beginner"));
});

test("welcoming rewards CONTRIBUTING plus a code of conduct", () => {
  const both = scoreWelcoming(repo(), issue());
  const neither = scoreWelcoming(
    repo({ hasContributing: false, hasCodeOfConduct: false }),
    issue(),
  );
  assert.ok(both > neither);
  // 0.6 + 0.3 with no long issue body; the last 0.1 needs a detailed description.
  assert.ok(both > 0.85, `both present scored ${both}`);

  const withBody = scoreWelcoming(repo(), issue({ body: "x".repeat(400) }));
  assert.ok(withBody > both, "a detailed issue body should add to the score");
});

test("scoreIssue produces a bounded score and an explanation", () => {
  const scored = scoreIssue(issue({ body: "x".repeat(400) }), repo(), profile);
  assert.ok(scored.matchScore > 0 && scored.matchScore <= 1);
  assert.ok(scored.reasons.length > 0, "a strong match should explain itself");
  assert.equal(scored.repo.hasContributing, true);
});

test("a missing repo record does not throw", () => {
  const scored = scoreIssue(issue(), null, profile);
  assert.ok(scored.matchScore >= 0 && scored.matchScore <= 1);
  assert.equal(scored.breakdown.repoHealth, 0);
});

test("ranking sorts descending and puts the ideal issue on top", () => {
  const ideal = issue({
    htmlUrl: "https://github.com/acme/tool/issues/1",
    repoFullName: "acme/tool",
    comments: 0,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
    labels: ["good first issue"],
  });
  const poor = issue({
    htmlUrl: "https://github.com/dead/repo/issues/2",
    repoFullName: "dead/repo",
    comments: 45,
    createdAt: daysAgo(900),
    updatedAt: daysAgo(900),
    labels: ["epic", "architecture"],
    assigned: true,
  });

  const repos = new Map<string, RepoSignals | null>([
    ["acme/tool", repo()],
    [
      "dead/repo",
      repo({
        fullName: "dead/repo",
        language: "Haskell",
        stars: 12,
        forks: 1,
        pushedAt: new Date(Date.now() - 900 * 86_400_000),
        hasContributing: false,
        hasCodeOfConduct: false,
        hasCi: false,
        topics: [],
      }),
    ],
  ]);

  const ranked = rankIssues([poor, ideal], repos, profile);
  assert.equal(ranked[0].htmlUrl, ideal.htmlUrl);
  assert.ok(ranked[0].matchScore > ranked[1].matchScore);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].matchScore >= ranked[i].matchScore, "not sorted descending");
  }
});

test("interest overlap nudges the score without dominating it", () => {
  const withTopic = scoreIssue(issue(), repo({ topics: ["react"] }), profile);
  const withoutTopic = scoreIssue(issue(), repo({ topics: ["compiler"] }), profile);
  assert.ok(withTopic.matchScore > withoutTopic.matchScore);
  assert.ok(withTopic.matchScore - withoutTopic.matchScore < 0.2, "interest must not swamp the other factors");
});

test("a fresh zero-star repo never outranks an established one", () => {
  // The failure this guards: with repo signals missing or weak, freshness and
  // low contention alone floated brand-new personal repos to the top of the feed.
  const junkRepo = repo({
    fullName: "someone/weekend-project",
    stars: 0,
    forks: 0,
    pushedAt: new Date(),
    language: "TypeScript",
    topics: [],
    hasContributing: false,
    hasCodeOfConduct: false,
    hasCi: false,
  });

  const junk = issue({
    htmlUrl: "https://github.com/someone/weekend-project/issues/1",
    repoFullName: "someone/weekend-project",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    comments: 0,
    labels: ["good first issue"],
  });

  // An established repo, deliberately given weaker freshness and contention.
  const solid = issue({
    htmlUrl: "https://github.com/acme/tool/issues/2",
    repoFullName: "acme/tool",
    createdAt: daysAgo(21),
    updatedAt: daysAgo(10),
    comments: 3,
    labels: ["good first issue"],
  });

  const repos = new Map<string, RepoSignals | null>([
    ["someone/weekend-project", junkRepo],
    ["acme/tool", repo()],
  ]);

  const ranked = rankIssues([junk, solid], repos, profile);
  assert.equal(
    ranked[0].repoFullName,
    "acme/tool",
    `junk repo won with ${ranked[0].matchScore} vs ${ranked[1].matchScore}`,
  );
});

test("an unknown repo scores below a known healthy one", () => {
  const known = scoreIssue(issue(), repo(), profile);
  const unknown = scoreIssue(issue(), null, profile);
  assert.ok(
    unknown.matchScore < known.matchScore,
    `unresolved repo scored ${unknown.matchScore} vs ${known.matchScore}`,
  );
});

test("an unproven repo scores below an adopted one with identical activity", () => {
  const active = { pushedAt: new Date(), hasCi: true };
  const unproven = scoreRepoHealth(repo({ ...active, stars: 0, forks: 0 }));
  const adopted = scoreRepoHealth(repo({ ...active, stars: 800, forks: 90 }));

  assert.ok(unproven < adopted * 0.5, `unproven ${unproven} vs adopted ${adopted}`);
  assert.ok(unproven > 0, "an unproven repo is discounted, not disqualified");
});

test("traction stops mattering once a repo is clearly adopted", () => {
  const a = scoreRepoHealth(repo({ stars: 800, forks: 90 }));
  const b = scoreRepoHealth(repo({ stars: 900, forks: 90 }));
  // Both are past the traction ceiling, so only the star curve separates them.
  assert.ok(Math.abs(a - b) < 0.03, `${a} vs ${b} moved more than the star curve should`);
});

/* --- computed skill graph vs self-report --------------------------------- */

test("a computed language skill outranks the self-reported list", () => {
  // Self-report puts TypeScript third; the computed graph says advanced with
  // high confidence. Evidence should win.
  const p: ScoreProfile = {
    languages: ["Go", "Rust", "TypeScript"],
    interests: [],
    skillLevel: "beginner",
    languageSkills: [{ language: "TypeScript", level: "advanced", confidence: 0.9 }],
  };
  const withGraph = scoreLanguage(issue(), repo({ language: "TypeScript" }), p);
  const selfOnly = scoreLanguage(issue(), repo({ language: "TypeScript" }), { ...p, languageSkills: undefined });
  assert.ok(withGraph > selfOnly, `${withGraph} should beat ${selfOnly}`);
});

test("low confidence leans back toward the self-report", () => {
  const p: ScoreProfile = {
    languages: ["TypeScript"],
    interests: [],
    skillLevel: "beginner",
    languageSkills: [{ language: "TypeScript", level: "beginner", confidence: 0.1 }],
  };
  const s = scoreLanguage(issue(), repo({ language: "TypeScript" }), p);
  assert.ok(s > 0.9, `a thin beginner signal must not drag a first-choice language to ${s}`);
});

test("computed skills apply even when the self-report list is empty", () => {
  const p: ScoreProfile = {
    languages: [],
    interests: [],
    skillLevel: "beginner",
    languageSkills: [{ language: "Python", level: "intermediate", confidence: 0.8 }],
  };
  assert.ok(scoreLanguage(issue(), repo({ language: "Python" }), p) > 0.7);
  assert.equal(scoreLanguage(issue(), repo({ language: "Haskell" }), p), 0.05, "an unlisted language still scores low");
});
