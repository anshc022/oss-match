import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CURATED_REPOS,
  buildCuratedQuery,
  curatedKey,
  curatedSlice,
} from "@/lib/fetcher/curated";

test("the vendored list is non-empty and well formed", () => {
  assert.ok(CURATED_REPOS.length > 500, `expected a large list, got ${CURATED_REPOS.length}`);
  for (const name of CURATED_REPOS) {
    assert.match(name, /^[^/\s]+\/[^/\s]+$/, `bad repo name: ${name}`);
  }
});

test("the list has no duplicates, case-insensitively", () => {
  const seen = new Set(CURATED_REPOS.map((r) => r.toLowerCase()));
  assert.equal(seen.size, CURATED_REPOS.length);
});

test("the search query scopes to one repo and ORs every label", () => {
  const q = buildCuratedQuery("owner/name");
  assert.ok(q.includes("repo:owner/name"));
  assert.ok(q.includes('"good first issue"'));
  assert.ok(q.includes('"help wanted"'));
  assert.ok(q.includes("state:open"));
  assert.ok(q.includes("is:issue"));
  // Comma between quoted labels is GitHub's OR; a space would mean AND and
  // would match almost nothing.
  assert.ok(/label:"[^"]+",("[^"]+",?)+/.test(q), q);
});

test("cache keys are stable and case-insensitive", () => {
  assert.equal(curatedKey("Owner/Name"), curatedKey("owner/name"));
  assert.notEqual(curatedKey("a/b"), curatedKey("a/c"));
});

test("a slice returns the requested window and where to resume", () => {
  const list = ["a/1", "a/2", "a/3", "a/4", "a/5"];
  const first = curatedSlice(0, 2, list);
  assert.deepEqual(first.repos, ["a/1", "a/2"]);
  assert.equal(first.nextOffset, 2);
  assert.equal(first.done, false);
  assert.equal(first.total, 5);

  const second = curatedSlice(first.nextOffset, 2, list);
  assert.deepEqual(second.repos, ["a/3", "a/4"]);
});

test("the last slice wraps back to the start", () => {
  const list = ["a/1", "a/2", "a/3"];
  const last = curatedSlice(2, 2, list);
  assert.deepEqual(last.repos, ["a/3"]);
  assert.equal(last.done, true);
  assert.equal(last.nextOffset, 0, "a finished pass restarts at the beginning");
});

test("an offset past the end wraps rather than returning nothing", () => {
  const list = ["a/1", "a/2", "a/3"];
  assert.deepEqual(curatedSlice(7, 1, list).repos, ["a/2"]);
});

test("an empty list or zero count is handled", () => {
  assert.deepEqual(curatedSlice(0, 5, []).repos, []);
  assert.equal(curatedSlice(0, 5, []).done, true);
  assert.deepEqual(curatedSlice(0, 0, ["a/1"]).repos, []);
});
