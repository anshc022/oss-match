import { test } from "node:test";
import assert from "node:assert/strict";
import { heuristicSkillGraph, SkillGraphSchema } from "../src/lib/skillgraph/analyzeSkill";
import type { ActivitySummary } from "../src/lib/skillgraph/collectUserActivity";

function summary(o: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    username: "dev",
    collectedAt: new Date().toISOString(),
    repos: [],
    mergedPrs: [],
    languages: {},
    totals: { repos: 0, commits: 0, mergedPrs: 0 },
    sparse: true,
    ...o,
  };
}

test("a sparse history yields beginner and says so", () => {
  const g = heuristicSkillGraph(summary({ totals: { repos: 1, commits: 2, mergedPrs: 0 } }));
  assert.equal(g.overallTier, "beginner");
  assert.equal(g.languageSkills.length, 0);
  assert.match(g.summary, /self-reported/i);
});

test("reviewed work in one language rates it above a scatter of trivial repos", () => {
  const g = heuristicSkillGraph(
    summary({
      sparse: false,
      totals: { repos: 5, commits: 60, mergedPrs: 4 },
      languages: {
        TypeScript: { repos: 2, commits: 50, prs: 4, linesChanged: 1800 },
        Python: { repos: 3, commits: 3, prs: 0, linesChanged: 0 },
        Lua: { repos: 1, commits: 1, prs: 0, linesChanged: 0 },
      },
    }),
  );
  assert.equal(g.languageSkills[0].language, "TypeScript");
  assert.equal(g.languageSkills[0].level, "advanced");
  assert.ok(!g.languageSkills.some((s) => s.language === "Lua"), "one trivial commit is not evidence");
  const py = g.languageSkills.find((s) => s.language === "Python");
  assert.ok(py && py.level === "beginner");
});

test("merged PRs are what lift the overall tier", () => {
  const noPrs = heuristicSkillGraph(
    summary({ sparse: false, totals: { repos: 4, commits: 30, mergedPrs: 0 }, languages: { Go: { repos: 4, commits: 30, prs: 0, linesChanged: 0 } } }),
  );
  const withPrs = heuristicSkillGraph(
    summary({ sparse: false, totals: { repos: 4, commits: 30, mergedPrs: 6 }, languages: { Go: { repos: 4, commits: 30, prs: 6, linesChanged: 2400 } } }),
  );
  assert.equal(noPrs.overallTier, "beginner");
  assert.equal(withPrs.overallTier, "advanced");
});

test("confidence stays inside 0-1 and the output matches the schema", () => {
  const g = heuristicSkillGraph(
    summary({ sparse: false, totals: { repos: 2, commits: 400, mergedPrs: 40 }, languages: { Rust: { repos: 2, commits: 400, prs: 40, linesChanged: 99_999 } } }),
  );
  for (const s of g.languageSkills) assert.ok(s.confidence >= 0 && s.confidence <= 1);
  assert.ok(SkillGraphSchema.safeParse(g).success, "heuristic output must satisfy the same schema as the model's");
});
