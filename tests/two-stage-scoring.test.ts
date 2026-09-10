import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_FACTORS,
  BASE_WEIGHT_TOTAL,
  WEIGHTS,
  scoreBase,
  scoreIssue,
  type ScoreProfile,
} from "../src/lib/scoring";
import type { CandidateIssue, RepoSignals } from "../src/lib/github";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function issue(o: Partial<CandidateIssue> = {}): CandidateIssue {
  return {
    id: 1, number: 42, title: "Fix the thing", body: "x".repeat(400),
    htmlUrl: "https://github.com/acme/tool/issues/42",
    repoFullName: "acme/tool", repoUrl: "https://github.com/acme/tool",
    labels: ["good first issue"], comments: 1,
    createdAt: daysAgo(5), updatedAt: daysAgo(2),
    hasLinkedPr: false, assigned: false, language: "TypeScript", ...o,
  };
}

function repo(o: Partial<RepoSignals> = {}): RepoSignals {
  return {
    fullName: "acme/tool", etag: "", stars: 1200, forks: 180, openIssues: 40,
    pushedAt: new Date(Date.now() - 2 * 86_400_000), language: "TypeScript",
    topics: ["react", "web"], defaultBranch: "main",
    cloneUrl: "https://github.com/acme/tool.git",
    hasContributing: true, contributingPath: "", hasCodeOfConduct: true,
    hasCi: true, archived: false, fetchedAt: new Date(), ...o,
  };
}

const profile: ScoreProfile = {
  languages: ["TypeScript", "Python"],
  interests: ["web"],
  skillLevel: "beginner",
};

test("base factors are exactly the user-independent ones", () => {
  assert.deepEqual([...BASE_FACTORS].sort(), [
    "contention", "freshness", "repoHealth", "welcoming",
  ]);
  // Language and difficulty depend on the user, so they must not be here.
  assert.ok(!BASE_FACTORS.includes("language" as never));
  assert.ok(!BASE_FACTORS.includes("difficulty" as never));
});

test("base weight total matches the sum of those four weights", () => {
  const expected = WEIGHTS.repoHealth + WEIGHTS.freshness + WEIGHTS.contention + WEIGHTS.welcoming;
  assert.ok(Math.abs(BASE_WEIGHT_TOTAL - expected) < 1e-9);
});

test("baseScore stays on 0-1", () => {
  const best = scoreBase(issue({ comments: 0, createdAt: daysAgo(1), updatedAt: daysAgo(1) }), repo());
  const worst = scoreBase(
    issue({ comments: 99, createdAt: daysAgo(900), updatedAt: daysAgo(900) }),
    repo({ archived: true, stars: 0, forks: 0, hasContributing: false, hasCodeOfConduct: false, hasCi: false }),
  );
  for (const s of [best.baseScore, worst.baseScore]) {
    assert.ok(s >= 0 && s <= 1, `baseScore out of range: ${s}`);
  }
  assert.ok(best.baseScore > worst.baseScore);
});

test("stored base factors equal what the full scorer computes", () => {
  const i = issue();
  const r = repo();
  const base = scoreBase(i, r);
  const full = scoreIssue(i, r, profile);

  for (const key of BASE_FACTORS) {
    assert.ok(
      Math.abs(base.breakdown[key] - full.breakdown[key]) < 1e-9,
      `${key}: stored ${base.breakdown[key]} vs live ${full.breakdown[key]}`,
    );
  }
});

test("the same issue scores differently for different users", () => {
  // This is why the per-user half cannot be precomputed by the fetcher.
  const i = issue();
  const r = repo();

  const beginner = scoreIssue(i, r, { ...profile, skillLevel: "beginner" });
  const advanced = scoreIssue(i, r, { ...profile, skillLevel: "advanced" });
  assert.notEqual(beginner.matchScore, advanced.matchScore);

  const wrongLang = scoreIssue(i, r, { ...profile, languages: ["Haskell"] });
  assert.ok(wrongLang.matchScore < beginner.matchScore);

  // But the base half is identical across all three.
  const base = scoreBase(i, r);
  for (const scored of [beginner, advanced, wrongLang]) {
    for (const key of BASE_FACTORS) {
      assert.ok(Math.abs(base.breakdown[key] - scored.breakdown[key]) < 1e-9);
    }
  }
});

test("baseScore orders candidates the same way for every user", () => {
  const strong = { i: issue({ comments: 0, createdAt: daysAgo(2) }), r: repo() };
  const weak = {
    i: issue({ htmlUrl: "https://github.com/x/y/issues/1", comments: 30, createdAt: daysAgo(600), updatedAt: daysAgo(600) }),
    r: repo({ fullName: "x/y", stars: 3, forks: 0, pushedAt: new Date(Date.now() - 500 * 86_400_000), hasContributing: false, hasCodeOfConduct: false, hasCi: false }),
  };

  assert.ok(scoreBase(strong.i, strong.r).baseScore > scoreBase(weak.i, weak.r).baseScore);
});

test("a repo we could not resolve still yields a usable base score", () => {
  const { baseScore, breakdown } = scoreBase(issue(), null);
  assert.ok(baseScore >= 0 && baseScore <= 1);
  assert.equal(breakdown.repoHealth, 0);
  assert.equal(breakdown.welcoming, 0);
});
