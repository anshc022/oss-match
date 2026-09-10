import { Schema, model, models, type Model } from "mongoose";

/**
 * Per-repo signals that the search API doesn't return: last push date, and
 * whether the repo ships CONTRIBUTING.md / CODE_OF_CONDUCT.md / CI. Each one
 * costs an API call, so results are cached for a day.
 */
const RepoMetaSchema = new Schema({
  fullName: { type: String, required: true, unique: true, index: true },
  /** Replayed as If-None-Match so an unchanged repo costs no rate limit. */
  etag: { type: String, default: "" },
  stars: { type: Number, default: 0 },
  forks: { type: Number, default: 0 },
  openIssues: { type: Number, default: 0 },
  pushedAt: { type: Date, default: null },
  language: { type: String, default: "" },
  topics: [{ type: String }],
  defaultBranch: { type: String, default: "main" },
  cloneUrl: { type: String, default: "" },
  hasContributing: { type: Boolean, default: false },
  contributingPath: { type: String, default: "" },
  hasCodeOfConduct: { type: Boolean, default: false },
  hasCi: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  fetchedAt: { type: Date, default: Date.now },
  /** Suggested contacts; see src/lib/mentor. Refreshed weekly, not with issues. */
  mentors: {
    type: [
      new Schema(
        {
          username: { type: String, required: true },
          avatarUrl: { type: String, default: "" },
          reason: { type: String, default: "" },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  mentorsSource: { type: String, enum: ["ai", "heuristic", ""], default: "" },
  mentorsComputedAt: { type: Date, default: null },
  /** Repo Deep Dive report; see src/lib/deepdive. Refreshed after 14 days. */
  deepDive: { type: Schema.Types.Mixed, default: null },
  /** idle | tree | analyzing | mapping | ready | error | unavailable */
  deepDiveStatus: { type: String, default: "idle" },
  deepDiveError: { type: String, default: "" },
  expiresAt: { type: Date, default: () => Date.now(), expires: 60 * 60 * 24 * 3 },
});

export type RepoMetaDoc = {
  _id: string;
  fullName: string;
  etag: string;
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: Date | null;
  language: string;
  topics: string[];
  defaultBranch: string;
  cloneUrl: string;
  hasContributing: boolean;
  contributingPath: string;
  hasCodeOfConduct: boolean;
  hasCi: boolean;
  archived: boolean;
  fetchedAt: Date;
  mentors?: { username: string; avatarUrl: string; reason: string }[];
  mentorsSource?: "ai" | "heuristic" | "";
  mentorsComputedAt?: Date | null;
  deepDive?: unknown;
  deepDiveStatus?: string;
  deepDiveError?: string;
};

export const RepoMeta: Model<RepoMetaDoc> =
  (models.RepoMeta as Model<RepoMetaDoc>) ??
  model<RepoMetaDoc>("RepoMeta", RepoMetaSchema);
