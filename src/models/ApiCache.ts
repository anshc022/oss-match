import { Schema, model, models, type Model } from "mongoose";

/**
 * One row per background fetch query. Three jobs:
 *
 *  1. `lastFetchedAt` enforces the per-query refresh interval, so an hourly
 *     cron only spends budget on queries that are actually due.
 *  2. `etag` is replayed as If-None-Match. GitHub's *search* endpoint does not
 *     currently emit ETags (it answers `cache-control: no-cache`), so this
 *     never produces a 304 today; the code is here because the contract is
 *     free to honour and other endpoints do support it.
 *  3. `resultHash` is what actually saves work on search. If a query returns
 *     the identical result set as last cycle, scoring and repo resolution are
 *     skipped. That is where the expensive budget goes: one search call
 *     versus three API calls per repo it turned up.
 */
const ApiCacheSchema = new Schema({
  queryKey: { type: String, required: true, unique: true, index: true },
  etag: { type: String, default: "" },
  /** Fingerprint of the last result set, used to short-circuit processing. */
  resultHash: { type: String, default: "" },
  lastFetchedAt: { type: Date, default: Date.now },
  /** Rolling counters, surfaced in the cron log to show cache effectiveness. */
  hitCount: { type: Number, default: 0 },
  missCount: { type: Number, default: 0 },
  unchangedCount: { type: Number, default: 0 },
  lastStatus: { type: Number, default: 0 },
  lastItemCount: { type: Number, default: 0 },
});

export type ApiCacheDoc = {
  _id: string;
  queryKey: string;
  etag: string;
  resultHash: string;
  lastFetchedAt: Date;
  hitCount: number;
  missCount: number;
  unchangedCount: number;
  lastStatus: number;
  lastItemCount: number;
};

export const ApiCache: Model<ApiCacheDoc> =
  (models.ApiCache as Model<ApiCacheDoc>) ??
  model<ApiCacheDoc>("ApiCache", ApiCacheSchema);
