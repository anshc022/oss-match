import Bottleneck from "bottleneck";

/**
 * Rate-limit-aware queue in front of every background GitHub call.
 *
 * Two jobs:
 *  1. Spacing. GitHub issues secondary rate limits for bursts even when the
 *     primary budget is healthy, so requests are serialised with a minimum gap
 *     rather than fired together. This is also what staggers the fetch cycle
 *     across languages: no extra sleep calls needed.
 *  2. Backing off before zero. Every response carries X-RateLimit-Remaining and
 *     X-RateLimit-Reset. When the remaining budget gets low the queue widens
 *     the gap between jobs to spread what is left over the time until reset,
 *     and once the floor is hit it stops handing out that kind of work.
 *
 * Budgets are tracked per resource, because GitHub meters them separately and
 * at wildly different scales: `core` allows 5,000/hour while `search` allows
 * 30/minute authenticated (10 unauthenticated). A single shared floor would
 * read every healthy search response as exhausted.
 */

export const RESOURCES = ["core", "search"] as const;
export type Resource = (typeof RESOURCES)[number];

/**
 * Budget guards are proportional to the advertised limit, not absolute.
 *
 * The same client can be metered at 5,000/hour (GitHub App), 5,000/hour
 * (user token) or 60/hour (unauthenticated), and search at 30/minute or
 * 10/minute. A fixed floor of 25 reserves a rounding error of the first and
 * nearly half of the last, and a fixed slowdown threshold of 250 is above
 * every unauthenticated limit — which pins pacing at its maximum from the
 * first response and stalls the cycle.
 */
export const RESERVE_FRACTION = 0.05;
export const SLOWDOWN_FRACTION = 0.2;

/**
 * Absolute guards for when the limit header is missing or tiny.
 *
 * The core minimum is deliberately above 1 request. One queued job can fan out
 * to several API calls — resolving a repo costs three — and the floor is only
 * checked between jobs, so the budget can undershoot by (calls per job - 1)
 * before the lane closes. Reserving a handful absorbs that.
 */
const MIN_RESERVE: Record<Resource, number> = { core: 8, search: 2 };
const MAX_RESERVE: Record<Resource, number> = { core: 250, search: 4 };

export function reserveFloor(resource: Resource, limit: number): number {
  if (!limit || limit <= 0) return MIN_RESERVE[resource];
  return Math.min(
    MAX_RESERVE[resource],
    Math.max(MIN_RESERVE[resource], Math.ceil(limit * RESERVE_FRACTION)),
  );
}

export function slowdownThreshold(resource: Resource, limit: number): number {
  if (!limit || limit <= 0) return MIN_RESERVE[resource] * 3;
  return Math.max(reserveFloor(resource, limit) * 2, Math.ceil(limit * SLOWDOWN_FRACTION));
}

const DEFAULT_MIN_TIME_MS: Record<Resource, number> = { core: 400, search: 2200 };
const MAX_MIN_TIME_MS = 20_000;

export type RateLimitSnapshot = {
  resource: Resource;
  remaining: number;
  limit: number;
  /** Epoch seconds. */
  reset: number;
  observedAt: number;
};

type Lane = {
  limiter: Bottleneck;
  snapshot: RateLimitSnapshot | null;
  exhausted: boolean;
  /** Set when GitHub returns a secondary (abuse) limit rather than a budget one. */
  penalised: boolean;
  minTime: number;
};

export class RateLimitedQueue {
  private lanes: Record<Resource, Lane>;
  /** Requests declined because a budget floor was reached. */
  public skipped = 0;

  constructor(opts?: {
    minTime?: Partial<Record<Resource, number>>;
    maxConcurrent?: number;
  }) {
    const maxConcurrent = opts?.maxConcurrent ?? 1;
    this.lanes = RESOURCES.reduce((acc, resource) => {
      const minTime = opts?.minTime?.[resource] ?? DEFAULT_MIN_TIME_MS[resource];
      acc[resource] = {
        limiter: new Bottleneck({ maxConcurrent, minTime }),
        snapshot: null,
        exhausted: false,
        penalised: false,
        minTime,
      };
      return acc;
    }, {} as Record<Resource, Lane>);
  }

  rateLimitFor(resource: Resource): RateLimitSnapshot | null {
    return this.lanes[resource].snapshot;
  }

  /** The core budget, which is what the cycle report surfaces. */
  get rateLimit(): RateLimitSnapshot | null {
    return this.lanes.core.snapshot ?? this.lanes.search.snapshot;
  }

  isExhausted(resource: Resource = "core") {
    const lane = this.lanes[resource];
    return lane.exhausted || lane.penalised;
  }

  /** True when the lane stopped because of an abuse limit, not a spent budget. */
  isPenalised(resource: Resource = "core") {
    return this.lanes[resource].penalised;
  }

  /**
   * GitHub's secondary rate limit ("abuse detection") is separate from the
   * hourly budget: it fires on request *pace* and the budget headers still look
   * healthy. It is returned as 403 or 429 with a distinctive body, sometimes
   * with Retry-After.
   *
   * Backing off by a few seconds is not enough — GitHub asks for minutes, and a
   * cycle that keeps probing just extends the block. So the lane closes for the
   * rest of this cycle and the next scheduled run picks the queries back up.
   */
  penalise(resource: Resource, retryAfterSeconds?: number) {
    const lane = this.lanes[resource];
    lane.penalised = true;
    lane.minTime = MAX_MIN_TIME_MS;
    lane.limiter.updateSettings({ minTime: MAX_MIN_TIME_MS });
    this.penalties.push({ resource, retryAfterSeconds: retryAfterSeconds ?? null });
  }

  /** Secondary limits hit during this cycle, for the log line. */
  public penalties: Array<{ resource: Resource; retryAfterSeconds: number | null }> = [];

  minTimeMs(resource: Resource = "core") {
    return this.lanes[resource].minTime;
  }

  /**
   * Read the rate-limit headers off a response (or a thrown HttpError) and
   * adjust the matching lane. `x-ratelimit-resource` says which budget was
   * spent; GitHub omits it only on responses that carry no budget at all.
   */
  observe(headers: Record<string, unknown> | undefined) {
    if (!headers) return;

    const remaining = toInt(headers["x-ratelimit-remaining"]);
    const limit = toInt(headers["x-ratelimit-limit"]);
    const reset = toInt(headers["x-ratelimit-reset"]);
    if (remaining === null || reset === null) return;

    const resource = normalizeResource(headers["x-ratelimit-resource"]);
    const lane = this.lanes[resource];

    lane.snapshot = {
      resource,
      remaining,
      limit: limit ?? 0,
      reset,
      observedAt: Date.now(),
    };

    const floor = reserveFloor(resource, limit ?? 0);
    if (remaining <= floor) {
      lane.exhausted = true;
      return;
    }

    lane.exhausted = false;
    lane.minTime = this.pacingFor(resource, remaining, reset, limit ?? 0);
    lane.limiter.updateSettings({ minTime: lane.minTime });
  }

  /**
   * Spread the remaining budget evenly over the time left until reset, so the
   * fetcher glides down to the floor instead of sprinting into it.
   */
  private pacingFor(
    resource: Resource,
    remaining: number,
    reset: number,
    limit: number,
  ) {
    const base = DEFAULT_MIN_TIME_MS[resource];
    if (remaining > slowdownThreshold(resource, limit)) return base;

    const msUntilReset = Math.max(0, reset * 1000 - Date.now());
    const spendable = Math.max(1, remaining - reserveFloor(resource, limit));
    const spaced = Math.ceil(msUntilReset / spendable);

    return Math.min(MAX_MIN_TIME_MS, Math.max(base, spaced));
  }

  /**
   * Queue one GitHub call against a named budget. Returns null when that
   * budget's floor has been reached, so callers degrade to "fetched less this
   * cycle" rather than erroring.
   */
  async run<T>(fn: () => Promise<T>, resource: Resource = "core"): Promise<T | null> {
    if (this.isExhausted(resource)) {
      this.skipped += 1;
      return null;
    }
    return this.lanes[resource].limiter.schedule(fn);
  }

  /** Resolves once every queued job has settled. */
  async drain() {
    await Promise.all(
      RESOURCES.map((r) =>
        this.lanes[r].limiter.stop({ dropWaitingJobs: false }).catch(() => {}),
      ),
    );
  }
}

/** GitHub reports graphql, integration_manifest and others; treat those as core. */
function normalizeResource(value: unknown): Resource {
  return String(value ?? "").toLowerCase() === "search" ? "search" : "core";
}

function toInt(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : null;
}

/**
 * Recognise a secondary rate limit. GitHub returns 403 or 429 with a message
 * naming abuse detection or the secondary limit; the numeric status alone is
 * ambiguous, since 403 is also plain "forbidden".
 */
export function isSecondaryRateLimit(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  if (status !== 403 && status !== 429) return false;
  const message = String((err as { message?: string }).message ?? "");
  return /abuse detection|secondary rate limit|retry your request again later/i.test(
    message,
  );
}

/** Retry-After, in seconds, when GitHub supplies one. */
export function retryAfterSeconds(err: unknown): number | undefined {
  const headers = (err as { response?: { headers?: Record<string, unknown> } })
    .response?.headers;
  const raw = headers?.["retry-after"];
  const n = Number(String(raw ?? ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
