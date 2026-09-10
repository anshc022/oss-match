import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RateLimitedQueue,
  reserveFloor,
  slowdownThreshold,
} from "../src/lib/fetcher/limiter";

/** GitHub tags every response with which budget it spent. */
const headers = (
  resource: "core" | "search",
  remaining: number,
  resetInSec = 3600,
  limit = resource === "core" ? 5000 : 30,
) => ({
  "x-ratelimit-resource": resource,
  "x-ratelimit-remaining": String(remaining),
  "x-ratelimit-limit": String(limit),
  "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + resetInSec),
});

const fast = { minTime: { core: 1, search: 1 } };

test("jobs run and return their value", async () => {
  const q = new RateLimitedQueue(fast);
  assert.equal(await q.run(async () => "ok"), "ok");
});

test("headers are parsed into a per-resource snapshot", () => {
  const q = new RateLimitedQueue(fast);
  q.observe(headers("core", 4321));
  q.observe(headers("search", 27));

  assert.equal(q.rateLimitFor("core")?.remaining, 4321);
  assert.equal(q.rateLimitFor("core")?.limit, 5000);
  assert.equal(q.rateLimitFor("search")?.remaining, 27);
  assert.equal(q.rateLimitFor("search")?.limit, 30);
});

test("a healthy search budget is not mistaken for an exhausted core budget", () => {
  // The regression this guards: search allows 30/minute while core allows
  // 5000/hour, so a shared floor of 25 would read every normal search
  // response as exhausted and stall the whole cycle.
  const q = new RateLimitedQueue(fast);
  q.observe(headers("core", 4900));
  q.observe(headers("search", 20));

  assert.equal(q.isExhausted("search"), false, "20 of 30 searches left is healthy");
  assert.equal(q.isExhausted("core"), false);
});

test("each budget hits its own floor independently", async () => {
  const q = new RateLimitedQueue(fast);
  q.observe(headers("search", reserveFloor("search", 30)));
  q.observe(headers("core", 4000));

  assert.equal(q.isExhausted("search"), true);
  assert.equal(q.isExhausted("core"), false);

  let searchRan = false;
  const searched = await q.run(async () => { searchRan = true; return "x"; }, "search");
  assert.equal(searched, null);
  assert.equal(searchRan, false);

  // Core work continues even though search is spent.
  assert.equal(await q.run(async () => "core ok", "core"), "core ok");
  assert.equal(q.skipped, 1);
});

test("unknown resources are metered as core", () => {
  const q = new RateLimitedQueue(fast);
  q.observe({ ...headers("core", 100), "x-ratelimit-resource": "graphql" });
  assert.equal(q.rateLimitFor("core")?.remaining, 100);
});

test("a missing resource header defaults to core", () => {
  const q = new RateLimitedQueue(fast);
  const h = headers("core", 500) as Record<string, unknown>;
  delete h["x-ratelimit-resource"];
  q.observe(h);
  assert.equal(q.rateLimitFor("core")?.remaining, 500);
});

test("recovering budget re-opens the lane", async () => {
  const q = new RateLimitedQueue(fast);
  q.observe(headers("core", reserveFloor("core", 5000) - 1));
  assert.equal(q.isExhausted("core"), true);
  q.observe(headers("core", 4000));
  assert.equal(q.isExhausted("core"), false);
  assert.equal(await q.run(async () => 42), 42);
});

test("a healthy budget keeps the default pacing", () => {
  const q = new RateLimitedQueue();
  const before = q.minTimeMs("core");
  q.observe(headers("core", slowdownThreshold("core", 5000) + 500));
  assert.equal(q.minTimeMs("core"), before);
});

test("a low budget widens the gap between requests", () => {
  const q = new RateLimitedQueue();
  q.observe(headers("core", slowdownThreshold("core", 5000) + 500));
  const quick = q.minTimeMs("core");

  // Between the floor and the slowdown threshold: still spendable, but it
  // should be paced out over the time left rather than sprinted.
  const between =
    Math.floor((reserveFloor("core", 5000) + slowdownThreshold("core", 5000)) / 2);
  q.observe(headers("core", between, 3600, 5000));
  const slow = q.minTimeMs("core");

  assert.equal(q.isExhausted("core"), false, "this budget is low, not spent");
  assert.ok(slow > quick, `expected slower pacing, got ${slow} vs ${quick}`);
});

test("pacing is capped so one cycle cannot stall indefinitely", () => {
  const q = new RateLimitedQueue();
  q.observe(headers("core", reserveFloor("core", 5000) + 1, 3600));
  assert.ok(q.minTimeMs("core") <= 20_000, `pacing ran away to ${q.minTimeMs("core")}ms`);
});

test("missing or malformed headers are ignored rather than throwing", () => {
  const q = new RateLimitedQueue(fast);
  q.observe(undefined);
  q.observe({});
  q.observe({ "x-ratelimit-remaining": "not-a-number" });
  assert.equal(q.rateLimitFor("core"), null);
  assert.equal(q.isExhausted("core"), false);
});

test("requests on one lane are serialised, not fired together", async () => {
  const q = new RateLimitedQueue({ minTime: { core: 20, search: 20 }, maxConcurrent: 1 });
  let active = 0;
  let peak = 0;

  await Promise.all(
    Array.from({ length: 5 }, () =>
      q.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
      }, "core"),
    ),
  );

  assert.equal(peak, 1, `expected serial execution, saw ${peak} in flight`);
});

test("spacing staggers a batch over time", async () => {
  const q = new RateLimitedQueue({ minTime: { core: 30, search: 30 } });
  const start = Date.now();
  await Promise.all(Array.from({ length: 4 }, () => q.run(async () => null, "core")));
  assert.ok(Date.now() - start >= 60, "batch finished too fast to have been staggered");
});

/* --- secondary (abuse) rate limits ------------------------------------- */

function abuseError(status: number, retryAfter?: string) {
  return Object.assign(
    new Error(
      "You have triggered an abuse detection mechanism. Please wait a few minutes before you try again.",
    ),
    { status, response: { headers: retryAfter ? { "retry-after": retryAfter } : {} } },
  );
}

test("a secondary rate limit is told apart from a plain 403", async () => {
  const { isSecondaryRateLimit } = await import("../src/lib/fetcher/limiter");

  assert.equal(isSecondaryRateLimit(abuseError(429)), true);
  assert.equal(isSecondaryRateLimit(abuseError(403)), true);
  assert.equal(
    isSecondaryRateLimit(Object.assign(new Error("Bad credentials"), { status: 403 })),
    false,
    "a plain 403 must not close the lane",
  );
  assert.equal(
    isSecondaryRateLimit(Object.assign(new Error("Not Found"), { status: 404 })),
    false,
  );
});

test("retry-after is read when GitHub supplies one", async () => {
  const { retryAfterSeconds } = await import("../src/lib/fetcher/limiter");
  assert.equal(retryAfterSeconds(abuseError(429, "60")), 60);
  assert.equal(retryAfterSeconds(abuseError(429)), undefined);
  assert.equal(retryAfterSeconds(abuseError(429, "nonsense")), undefined);
});

test("a penalised lane stops accepting work even though the budget looks healthy", async () => {
  // This is the regression: the abuse limit fires on request pace, so
  // x-ratelimit-remaining still reads fine and the budget floor never trips.
  const q = new RateLimitedQueue(fast);
  q.observe(headers("search", 9, 60, 10));
  assert.equal(q.isExhausted("search"), false);

  q.penalise("search", 60);

  assert.equal(q.isPenalised("search"), true);
  assert.equal(q.isExhausted("search"), true, "a penalised lane must refuse work");
  assert.equal(await q.run(async () => "nope", "search"), null);

  // The other lane keeps going.
  assert.equal(q.isExhausted("core"), false);
  assert.equal(await q.run(async () => "core ok", "core"), "core ok");
});

test("a penalty is not cleared by a later healthy budget reading", () => {
  const q = new RateLimitedQueue(fast);
  q.penalise("search");
  q.observe(headers("search", 30, 60, 30));
  assert.equal(
    q.isExhausted("search"),
    true,
    "the lane stays closed for the rest of the cycle",
  );
});

test("penalties are recorded for the cycle log", () => {
  const q = new RateLimitedQueue(fast);
  q.penalise("search", 45);
  assert.deepEqual(q.penalties, [{ resource: "search", retryAfterSeconds: 45 }]);
});

/* --- proportional budget guards ----------------------------------------- */

test("guards scale with the advertised limit", async () => {
  // A GitHub App gets 5000/hour; unauthenticated gets 60. A fixed floor of 25
  // is a rounding error of the first and nearly half of the second.
  assert.ok(reserveFloor("core", 5000) > reserveFloor("core", 60));
  assert.ok(reserveFloor("core", 60) < 60 * 0.2, "floor must not eat a small budget");
  assert.ok(reserveFloor("search", 30) >= 1);
});

test("an unauthenticated budget does not start out already throttled", () => {
  // The regression: an absolute slowdown threshold of 250 sits above the whole
  // 60-request unauthenticated limit, so the very first response pinned pacing
  // at its 20s maximum and the cycle stalled.
  const q = new RateLimitedQueue();
  const base = q.minTimeMs("core");
  q.observe(headers("core", 59, 3600, 60));

  assert.equal(q.isExhausted("core"), false);
  assert.equal(
    q.minTimeMs("core"),
    base,
    `a nearly full 60-request budget must not throttle (got ${q.minTimeMs("core")}ms)`,
  );
});

test("a nearly spent small budget still throttles", () => {
  const q = new RateLimitedQueue();
  const base = q.minTimeMs("core");
  const low = Math.floor(
    (reserveFloor("core", 60) + slowdownThreshold("core", 60)) / 2,
  );
  q.observe(headers("core", low, 3600, 60));

  assert.equal(q.isExhausted("core"), false, "low, but not yet spent");
  assert.ok(q.minTimeMs("core") > base, "a low small budget should slow down");
});

test("the core floor leaves room for a job that fans out to several calls", () => {
  // Resolving one repo costs three API calls, and the floor is only checked
  // between jobs, so the reserve has to absorb that overshoot.
  assert.ok(
    reserveFloor("core", 60) >= 3,
    "floor must cover a multi-call job's overshoot",
  );
  assert.ok(reserveFloor("core", 5000) >= 3);
});

test("slowdown always sits above the floor", () => {
  for (const limit of [10, 30, 60, 1000, 5000]) {
    assert.ok(
      slowdownThreshold("core", limit) > reserveFloor("core", limit),
      `limit ${limit}: threshold must be above the floor`,
    );
  }
});

test("a missing limit header falls back to safe absolutes", () => {
  assert.ok(reserveFloor("core", 0) >= 1);
  assert.ok(slowdownThreshold("core", 0) > reserveFloor("core", 0));
});
