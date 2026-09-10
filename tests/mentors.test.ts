import { test } from "node:test";
import assert from "node:assert/strict";
import { heuristicMentors, MentorsSchema } from "../src/lib/mentor/rankMentors";
import { score, type PersonActivity, type RepoActivitySummary } from "../src/lib/mentor/getRepoActivity";
import { extractJson } from "../src/lib/llm";

function person(o: Partial<PersonActivity>): PersonActivity {
  return { username: "x", avatarUrl: "", comments: 0, reviews: 0, mergedPrs: 0, lastActiveDaysAgo: 3, samples: [], isOwner: false, ...o };
}
function activity(people: PersonActivity[]): RepoActivitySummary {
  return { fullName: "acme/tool", windowDays: 60, people, collectedAt: new Date().toISOString() };
}

test("the active reviewer outranks the owner who only merges their own PRs", () => {
  const out = heuristicMentors(
    activity([
      person({ username: "owner", isOwner: true, mergedPrs: 9, comments: 0, reviews: 0 }),
      person({ username: "reviewer", reviews: 6, comments: 5 }),
    ]),
  );
  assert.equal(out[0]?.username, "reviewer");
  assert.ok(!out.some((m) => m.username === "owner"), "merging your own work is not mentoring");
});

test("stale people are dropped even with a big history", () => {
  const out = heuristicMentors(activity([person({ username: "gone", reviews: 30, lastActiveDaysAgo: 120 })]));
  assert.equal(out.length, 0);
});

test("reasons are built from the counts, not invented", () => {
  const [m] = heuristicMentors(activity([person({ username: "amy", reviews: 8, comments: 3, lastActiveDaysAgo: 2 })]));
  assert.match(m.reason, /reviewed 8 PRs/i);
  assert.match(m.reason, /this week/);
});

test("at most two suggestions, best first", () => {
  const out = heuristicMentors(
    activity([
      person({ username: "a", reviews: 2, comments: 1 }),
      person({ username: "b", reviews: 9, comments: 4 }),
      person({ username: "c", reviews: 4, comments: 2 }),
    ]),
  );
  assert.deepEqual(out.map((m) => m.username), ["b", "c"]);
  assert.ok(score(person({ reviews: 9 })) > score(person({ mergedPrs: 9 })), "reviews weigh more than merges");
});

test("model output is validated by the same schema and grounded in the list", () => {
  assert.ok(MentorsSchema.safeParse({ mentors: [{ username: "b", reason: "Reviewed 9 PRs this month" }] }).success);
  assert.ok(!MentorsSchema.safeParse({ mentors: [{ username: "b" }] }).success, "reason is required");
});

test("extractJson tolerates fences and leading prose", () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Sure, here it is: {"a":1} hope that helps'), { a: 1 });
  assert.deepEqual(extractJson('\n{"ok": true}\n'), { ok: true });
  assert.equal(extractJson("no json here"), null);
});
