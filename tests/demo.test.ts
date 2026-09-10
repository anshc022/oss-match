import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Demo mode hands out a signed-in account to anyone who asks. These tests
 * exist to keep that impossible anywhere it would be a vulnerability, so they
 * assert the gates rather than the convenience.
 */

const KEYS = ["DEMO_MODE", "NODE_ENV", "VERCEL"] as const;

// NODE_ENV is typed read-only, but the gate reads it at call time and these
// tests exist precisely to prove it is honoured. Write through a mutable view.
const env = process.env as Record<string, string | undefined>;

/** Import the module fresh, since the gate reads env at call time. */
async function demoModeWith(next: Partial<Record<(typeof KEYS)[number], string | undefined>>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of KEYS) saved[k] = env[k];
  for (const k of KEYS) {
    const v = next[k];
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  try {
    const { demoMode } = await import("@/lib/demo");
    return demoMode();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete env[k];
      else env[k] = saved[k] as string;
    }
  }
}

test("demo mode is off unless it is asked for", async () => {
  assert.equal(await demoModeWith({ DEMO_MODE: undefined, NODE_ENV: "development" }), false);
  assert.equal(await demoModeWith({ DEMO_MODE: "false", NODE_ENV: "development" }), false);
});

test("demo mode is on for local development that opts in", async () => {
  assert.equal(await demoModeWith({ DEMO_MODE: "true", NODE_ENV: "development", VERCEL: undefined }), true);
});

test("a production build can never enable it", async () => {
  assert.equal(
    await demoModeWith({ DEMO_MODE: "true", NODE_ENV: "production", VERCEL: undefined }),
    false,
    "DEMO_MODE must not be enough on a production build",
  );
});

test("being on Vercel disqualifies it, preview included", async () => {
  assert.equal(
    await demoModeWith({ DEMO_MODE: "true", NODE_ENV: "development", VERCEL: "1" }),
    false,
    "a preview deployment runs with NODE_ENV=development, so VERCEL is the gate that matters there",
  );
});
