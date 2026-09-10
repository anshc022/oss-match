import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

/**
 * Server-to-server GitHub client for the background fetcher.
 *
 * A GitHub App installation gets 5,000 requests/hour of its own, independent of
 * any user's token, and scales with installation count rather than being tied
 * to one person's account. That matters when a traffic spike means more
 * fetching, not less.
 *
 * Falls back to GITHUB_TOKEN, then to unauthenticated, so local development
 * works without registering an App.
 */

export type AppCredentials = {
  appId: string;
  privateKey: string;
  installationId: string;
};

export function readAppCredentials(): AppCredentials | null {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

  if (!appId || !privateKey || !installationId) return null;
  return { appId, privateKey: normalizePrivateKey(privateKey), installationId };
}

/**
 * Env vars cannot hold real newlines on most hosts, so the PEM is usually
 * stored with literal `\n` or base64-encoded. Accept both.
 */
export function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN") && trimmed.includes("PRIVATE KEY")) {
    return trimmed.replace(/\\n/g, "\n");
  }
  // Assume base64 of the whole PEM.
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (decoded.includes("PRIVATE KEY")) return decoded;
  } catch {
    // fall through
  }
  return trimmed.replace(/\\n/g, "\n");
}

export type AuthMode = "app" | "token" | "anonymous";

let cached: { octokit: Octokit; mode: AuthMode } | null = null;

/**
 * The client used by every background fetch. Octokit's auth-app strategy mints
 * and refreshes installation tokens on its own, so there is no token lifecycle
 * to manage here.
 *
 * Throttling and retry stay disabled for the same reason as the request-path
 * client: the fetcher has its own rate-limit-aware queue, and a plugin that
 * sleeps for an hour inside a cron invocation would just hit the platform's
 * function timeout instead.
 */
export function fetcherOctokit(): { octokit: Octokit; mode: AuthMode } {
  if (cached) return cached;

  const shared = {
    userAgent: "oss-match-fetcher",
    throttle: { onRateLimit: () => false, onSecondaryRateLimit: () => false },
    retry: { enabled: false },
    request: { timeout: 15_000 },
  };

  const app = readAppCredentials();
  if (app) {
    cached = {
      mode: "app",
      octokit: new Octokit({
        ...shared,
        authStrategy: createAppAuth,
        auth: {
          appId: app.appId,
          privateKey: app.privateKey,
          installationId: app.installationId,
        },
      }),
    };
    return cached;
  }

  if (process.env.GITHUB_TOKEN) {
    cached = {
      mode: "token",
      octokit: new Octokit({ ...shared, auth: process.env.GITHUB_TOKEN }),
    };
    return cached;
  }

  cached = { mode: "anonymous", octokit: new Octokit(shared) };
  return cached;
}

/** Test seam: drops the memoised client so a new env can take effect. */
export function resetFetcherOctokit() {
  cached = null;
}

/**
 * Confirms the App credentials actually mint a token. Used by the cron route's
 * health line so a misconfigured key shows up in logs rather than as a silent
 * fallback to a 60/hour anonymous client.
 */
export async function describeAuth(): Promise<{
  mode: AuthMode;
  ok: boolean;
  detail: string;
}> {
  const { octokit, mode } = fetcherOctokit();
  try {
    const res = await octokit.request("GET /rate_limit");
    const core = res.data.resources.core;
    return {
      mode,
      ok: true,
      detail: `core ${core.remaining}/${core.limit}`,
    };
  } catch (err) {
    return {
      mode,
      ok: false,
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }
}
