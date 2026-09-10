import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runFetchCycle } from "@/lib/fetcher/fetch-issues";
import { logFetchCycle } from "@/lib/fetcher/report";
import { describeAuth } from "@/lib/github-app-client";
import { boostMode, hacktoberfestMode } from "@/lib/fetcher/queries";

export const dynamic = "force-dynamic";
/** Long enough for a full cycle; the cycle has its own internal deadline too. */
export const maxDuration = 60;

/**
 * Background fetch trigger. Called on a schedule (see vercel.json), never by a
 * user request. Everything user-facing reads the collection this populates.
 */
export async function GET(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) {
    // 404 rather than 401: an unauthenticated caller learns nothing about
    // whether this route exists.
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";
  const languages = url.searchParams.get("languages")?.split(",").filter(Boolean);
  // ?mentors=N refreshes up to N repos' suggested contacts; ?issues=false
  // skips the issue queries so a call can be spent entirely on that.
  const mentorsLimit = Number(url.searchParams.get("mentors")) || undefined;
  const skipIssues = url.searchParams.get("issues") === "false";

  const health = await describeAuth();
  if (!health.ok) {
    console.error(
      `[fetch] auth check failed (mode=${health.mode}): ${health.detail}`,
    );
  } else {
    console.log(`[fetch] auth ok (mode=${health.mode}, ${health.detail})`);
  }

  try {
    const report = await runFetchCycle({
      force,
      languages: languages?.length ? languages : undefined,
      mentorsLimit,
      skipIssues,
      // Well under maxDuration. The deadline stops new work being started,
      // but a call already in flight still has to finish, so the headroom
      // needs to cover one slow request plus the final write.
      deadlineMs: 40_000,
    });

    logFetchCycle(report);

    return NextResponse.json({
      ok: true,
      authMode: report.authMode,
      boost: boostMode(),
      hacktoberfest: hacktoberfestMode(),
      summary: {
        durationMs: report.durationMs,
        queriesPlanned: report.queriesPlanned,
        queriesRun: report.queriesRun,
        etagHits: report.etagHits,
        unchangedHits: report.unchangedHits,
        etagMisses: report.etagMisses,
        issuesUpserted: report.issuesUpserted,
        reposResolved: report.reposResolved,
        coreRemaining: report.coreRemaining,
        searchRemaining: report.searchRemaining,
        mentorsRefreshed: report.mentorsRefreshed,
        budgetSkips: report.budgetSkips,
        secondaryLimits: report.secondaryLimits,
        failures: report.failures,
      },
    });
  } catch (err) {
    console.error("[fetch] cycle threw:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "cycle failed" },
      { status: 500 },
    );
  }
}

/**
 * Accepts either `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends)
 * or `x-cron-secret`. Without CRON_SECRET set the route is disabled outright
 * rather than left open.
 */
function authorize(req: Request): { ok: boolean } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[fetch] CRON_SECRET is not set; refusing to run");
    return { ok: false };
  }

  const header =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.headers.get("x-cron-secret") ??
    "";

  return { ok: safeEqual(header, secret) };
}

/** Constant-time compare, so a wrong secret leaks nothing through timing. */
function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
