import { test } from "node:test";
import assert from "node:assert/strict";
import { pooled } from "../src/lib/pool";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("results keep the order of the input, not completion order", async () => {
  const out = await pooled([30, 5, 20, 1], 4, 1000, async (ms) => {
    await sleep(ms);
    return ms;
  });
  assert.deepEqual(out, [30, 5, 20, 1]);
});

test("concurrency never exceeds the cap", async () => {
  let active = 0;
  let peak = 0;
  await pooled(Array.from({ length: 20 }, (_, i) => i), 4, 2000, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await sleep(5);
    active -= 1;
    return true;
  });
  assert.ok(peak <= 4, `peak concurrency was ${peak}`);
  assert.ok(peak > 1, "should actually run in parallel");
});

test("one rejection yields null without sinking the batch", async () => {
  const out = await pooled([1, 2, 3], 3, 1000, async (n) => {
    if (n === 2) throw new Error("boom");
    return n * 10;
  });
  assert.deepEqual(out, [10, null, 30]);
});

test("work stops at the deadline and unstarted items stay null", async () => {
  const started: number[] = [];
  const started_at = Date.now();
  const out = await pooled(Array.from({ length: 40 }, (_, i) => i), 2, 120, async (n) => {
    started.push(n);
    await sleep(40);
    return n;
  });
  const elapsed = Date.now() - started_at;

  assert.ok(elapsed < 1000, `took ${elapsed}ms, deadline should have cut it short`);
  assert.ok(started.length < 40, `all ${started.length} items ran despite the deadline`);
  assert.ok(out.some((v) => v === null), "abandoned items should be null");
  assert.ok(out.some((v) => v !== null), "completed items should keep their value");
});

test("an empty input list resolves immediately", async () => {
  const out = await pooled([], 5, 1000, async () => "never");
  assert.deepEqual(out, []);
});

test("a cap larger than the input does not spawn idle workers", async () => {
  const out = await pooled([1, 2], 10, 1000, async (n) => n);
  assert.deepEqual(out, [1, 2]);
});
