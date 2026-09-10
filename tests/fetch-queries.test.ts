import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_LABELS,
  BOOST_INTERVAL_MS,
  HACKTOBERFEST_INTERVAL_MS,
  NORMAL_INTERVAL_MS,
  buildQueries,
  interestsForTopics,
  looksHacktoberfest,
  queryKey,
} from "../src/lib/fetcher/queries";

const LANGS = ["TypeScript", "Go"] as const;

test("query keys are stable and case-insensitive", () => {
  assert.equal(queryKey("TypeScript", "Good First Issue"), queryKey("typescript", "good first issue"));
  assert.ok(queryKey("Go", "help wanted", "web").includes("topic:web"));
});

test("a normal cycle covers every language and label pair", () => {
  const q = buildQueries({ languages: LANGS, hacktoberfest: false });
  assert.equal(q.length, LANGS.length * BASE_LABELS.length);
  assert.ok(q.every((x) => !x.isHacktoberfest));
  assert.equal(new Set(q.map((x) => x.key)).size, q.length, "keys must be unique");
});

test("hacktoberfest mode adds queries without dropping the normal ones", () => {
  const normal = buildQueries({ languages: LANGS, hacktoberfest: false });
  const boosted = buildQueries({ languages: LANGS, hacktoberfest: true });

  assert.equal(boosted.length, normal.length + LANGS.length);
  for (const n of normal) {
    assert.ok(boosted.some((b) => b.key === n.key), `lost normal query ${n.key}`);
  }
});

test("hacktoberfest queries are ordered first so a truncated cycle still refreshes them", () => {
  const q = buildQueries({ languages: LANGS, hacktoberfest: true });
  const lastHacktoberfest = q.map((x) => x.isHacktoberfest).lastIndexOf(true);
  const firstNormal = q.map((x) => x.isHacktoberfest).indexOf(false);
  assert.ok(lastHacktoberfest < firstNormal, "hacktoberfest queries must lead the list");
});

test("hacktoberfest queries refresh faster than normal ones", () => {
  const q = buildQueries({ languages: LANGS, hacktoberfest: true });
  const hf = q.find((x) => x.isHacktoberfest)!;
  const normal = q.find((x) => !x.isHacktoberfest)!;

  assert.equal(hf.minIntervalMs, HACKTOBERFEST_INTERVAL_MS);
  assert.ok(hf.minIntervalMs < normal.minIntervalMs);
});

test("the normal interval is three hours, and boost shortens it to one", () => {
  assert.equal(NORMAL_INTERVAL_MS, 3 * 60 * 60 * 1000);
  assert.equal(BOOST_INTERVAL_MS, 60 * 60 * 1000);
  assert.ok(BOOST_INTERVAL_MS < NORMAL_INTERVAL_MS);
});

test("hacktoberfest labels are detected regardless of case or decoration", () => {
  assert.ok(looksHacktoberfest(["Hacktoberfest"]));
  assert.ok(looksHacktoberfest(["good first issue", "hacktoberfest-accepted"]));
  assert.ok(!looksHacktoberfest(["good first issue", "bug"]));
  assert.ok(!looksHacktoberfest([]));
});

test("repo topics map back onto onboarding interests", () => {
  assert.deepEqual(interestsForTopics(["react", "nextjs"]), ["web"]);
  assert.deepEqual(interestsForTopics(["kubernetes"]), ["devops"]);
  assert.deepEqual(interestsForTopics(["nothing-relevant"]), []);
  // Topic casing from the API varies; matching must not depend on it.
  assert.deepEqual(interestsForTopics(["PyTorch"]), ["ml"]);
});

/* --- result fingerprinting ---------------------------------------------- */

import { hashResults } from "../src/lib/fetcher/fingerprint";
import type { CandidateIssue } from "../src/lib/github";

function item(o: Partial<CandidateIssue> = {}): CandidateIssue {
  return {
    id: 1, number: 1, title: "t", body: "", htmlUrl: "u",
    repoFullName: "a/b", repoUrl: "r", labels: ["good first issue"],
    comments: 0, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z",
    hasLinkedPr: false, assigned: false, language: "TypeScript", ...o,
  };
}

test("an identical result set hashes the same", () => {
  assert.equal(hashResults([item(), item({ id: 2 })]), hashResults([item(), item({ id: 2 })]));
});

test("reordering alone does not count as a change", () => {
  // GitHub's sort is by recency; two issues touched in the same second can
  // swap places without anything meaningful having changed.
  assert.equal(
    hashResults([item({ id: 1 }), item({ id: 2 })]),
    hashResults([item({ id: 2 }), item({ id: 1 })]),
  );
});

test("a change to any scoring input changes the hash", () => {
  const base = hashResults([item()]);
  assert.notEqual(base, hashResults([item({ comments: 3 })]), "comment count feeds contention");
  assert.notEqual(base, hashResults([item({ assigned: true })]), "assignment feeds contention");
  assert.notEqual(base, hashResults([item({ updatedAt: "2026-02-01T00:00:00Z" })]), "updatedAt feeds freshness");
  assert.notEqual(base, hashResults([item({ labels: ["help wanted"] })]), "labels feed difficulty");
});

test("label order does not change the hash", () => {
  assert.equal(
    hashResults([item({ labels: ["a", "b"] })]),
    hashResults([item({ labels: ["b", "a"] })]),
  );
});

test("adding or removing an issue changes the hash", () => {
  assert.notEqual(hashResults([item()]), hashResults([item(), item({ id: 2 })]));
  assert.notEqual(hashResults([]), hashResults([item()]));
});
