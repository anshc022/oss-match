/**
 * Demo mode: the app runs with no accounts, no secrets and no external
 * database, so someone can clone the repository and see it working before
 * deciding whether to invest in a full setup.
 *
 * It switches on a credentials sign-in that hands out a fixed local account.
 * That is a back door by definition, so it is gated three ways and every gate
 * has to pass. Being on a real deployment disqualifies it outright, whatever
 * the environment variables say.
 */
export function demoMode(): boolean {
  if (process.env.DEMO_MODE !== "true") return false;
  if (process.env.NODE_ENV === "production") return false;
  // Set on every Vercel build and runtime, preview included.
  if (process.env.VERCEL === "1") return false;
  return true;
}

/** The account demo sign-in resolves to. Not a real GitHub user. */
export const DEMO_USER = {
  githubId: "demo-0",
  username: "demo-explorer",
  name: "Demo Explorer",
  avatarUrl: "",
} as const;
