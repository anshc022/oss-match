import type { FetchCycleReport } from "@/lib/fetcher/fetch-issues";

/**
 * One compact block per cycle, sized to be readable in a hosting provider's
 * log viewer without needing a dashboard. Failures and skipped queries print
 * individually; successful ones are summarised.
 */
export function logFetchCycle(report: FetchCycleReport) {
  const {
    durationMs,
    authMode,
    hacktoberfest,
    queriesPlanned,
    queriesRun,
    etagHits,
    etagMisses,
    unchangedHits,
    issuesUpserted,
    reposResolved,
    rateLimitResetsIn,
    budgetSkips,
    failures,
    secondaryLimits,
    coreRemaining,
    searchRemaining,
    results,
  } = report;

  // Both kinds of hit skip the expensive half of a cycle.
  const saved = etagHits + unchangedHits;
  const savedRate = queriesRun > 0 ? Math.round((saved / queriesRun) * 100) : 0;

  const lines = [
    `[fetch] cycle done in ${(durationMs / 1000).toFixed(1)}s` +
      ` · auth=${authMode}` +
      (hacktoberfest ? " · hacktoberfest=on" : ""),
    `[fetch] queries: ${queriesRun} run of ${queriesPlanned} planned` +
      ` · ${skippedCount(results)} skipped` +
      (failures ? ` · ${failures} failed` : ""),
    `[fetch] cache: ${etagHits} etag-304 · ${unchangedHits} unchanged · ` +
      `${etagMisses} processed (${savedRate}% of queries skipped scoring)`,
    `[fetch] issues upserted: ${issuesUpserted} · repos resolved: ${reposResolved} · mentors refreshed: ${report.mentorsRefreshed}`,
    `[fetch] budget: core ${coreRemaining ?? "?"} · search ${searchRemaining ?? "?"}` +
      (rateLimitResetsIn !== null
        ? ` · resets in ${Math.round(rateLimitResetsIn / 60000)}m`
        : "") +
      (budgetSkips ? ` · ${budgetSkips} deferred at floor` : ""),
  ];

  for (const p of secondaryLimits) {
    lines.push(
      `[fetch] SECONDARY LIMIT on ${p.resource}: lane closed for this cycle` +
        (p.retryAfterSeconds ? ` (retry-after ${p.retryAfterSeconds}s)` : "") +
        " — remaining queries roll to the next run",
    );
  }

  console.log(lines.join("\n"));

  for (const r of results) {
    if (r.error) {
      console.warn(`[fetch]   ${r.key} FAILED status=${r.status} ${r.error}`);
    }
  }

  const stalled = results.filter(
    (r) => r.skippedReason && r.skippedReason !== "within refresh interval",
  );
  for (const r of stalled) {
    console.warn(`[fetch]   ${r.key} skipped: ${r.skippedReason}`);
  }
}

function skippedCount(results: FetchCycleReport["results"]) {
  return results.filter((r) => r.skippedReason).length;
}
