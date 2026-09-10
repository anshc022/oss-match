import { Schema, model, models, type Model } from "mongoose";

/**
 * The serving collection. Every user-facing feed request reads from here and
 * nowhere else, so a traffic spike costs Mongo reads rather than GitHub API
 * budget.
 *
 * Documents carry the full issue snapshot *and* the repo signals, because the
 * two user-dependent scoring factors (language fit, difficulty fit) have to be
 * computed per request. Storing the inputs means that stays pure CPU over a
 * document already in hand: no second query, no API call.
 */
const IssueSchema = new Schema(
  {
    // --- identity -----------------------------------------------------
    issueUrl: { type: String, required: true, unique: true, index: true },
    githubId: { type: Number, required: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },

    repoFullName: { type: String, required: true, index: true },
    repoUrl: { type: String, required: true },

    // --- issue signals (inputs to freshness / contention / difficulty) --
    labels: { type: [String], default: [], index: true },
    comments: { type: Number, default: 0 },
    issueCreatedAt: { type: Date, required: true },
    issueUpdatedAt: { type: Date, required: true },
    assigned: { type: Boolean, default: false },
    hasLinkedPr: { type: Boolean, default: false },

    // --- repo signals (inputs to health / welcoming / language / interest) --
    language: { type: String, default: "", index: true },
    topics: { type: [String], default: [] },
    stars: { type: Number, default: 0 },
    forks: { type: Number, default: 0 },
    pushedAt: { type: Date, default: null },
    defaultBranch: { type: String, default: "main" },
    cloneUrl: { type: String, default: "" },
    hasContributing: { type: Boolean, default: false },
    hasCodeOfConduct: { type: Boolean, default: false },
    hasCi: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },

    // --- precomputed, user-independent score ---------------------------
    /**
     * Weighted sum of the four factors that do not depend on who is asking:
     * repo health, freshness, contention, welcoming. Used as the DB-level sort
     * key; the per-user factors are layered on at read time.
     */
    baseScore: { type: Number, default: 0, index: true },
    baseBreakdown: {
      repoHealth: { type: Number, default: 0 },
      freshness: { type: Number, default: 0 },
      contention: { type: Number, default: 0 },
      welcoming: { type: Number, default: 0 },
    },

    /** Where this issue lives in the repo's Deep Dive architecture. */
    deepDiveLocation: { type: Schema.Types.Mixed, default: null },

    // --- provenance ----------------------------------------------------
    isHacktoberfest: { type: Boolean, default: false, index: true },
    /** Query keys that surfaced this issue, for debugging coverage gaps. */
    sourceQueries: { type: [String], default: [] },
    lastScoredAt: { type: Date, default: Date.now, index: true },
    lastSeenAt: { type: Date, default: Date.now },
    firstSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// The feed filters by language and sorts by baseScore; this covers both.
IssueSchema.index({ language: 1, baseScore: -1 });
IssueSchema.index({ isHacktoberfest: 1, baseScore: -1 });

export type IssueDoc = {
  _id: string;
  issueUrl: string;
  githubId: number;
  number: number;
  title: string;
  body: string;
  repoFullName: string;
  repoUrl: string;
  labels: string[];
  comments: number;
  issueCreatedAt: Date;
  issueUpdatedAt: Date;
  assigned: boolean;
  hasLinkedPr: boolean;
  language: string;
  topics: string[];
  stars: number;
  forks: number;
  pushedAt: Date | null;
  defaultBranch: string;
  cloneUrl: string;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasCi: boolean;
  archived: boolean;
  baseScore: number;
  baseBreakdown: {
    repoHealth: number;
    freshness: number;
    contention: number;
    welcoming: number;
  };
  isHacktoberfest: boolean;
  deepDiveLocation?: unknown;
  sourceQueries: string[];
  lastScoredAt: Date;
  lastSeenAt: Date;
  firstSeenAt: Date;
};

export const Issue: Model<IssueDoc> =
  (models.Issue as Model<IssueDoc>) ?? model<IssueDoc>("Issue", IssueSchema);
