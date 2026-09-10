import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
  type Types,
} from "mongoose";
import {
  INTERESTS,
  SKILL_LEVELS,
  TIME_AVAILABILITY,
} from "@/lib/constants";

/** Computed from real GitHub activity; see src/lib/skillgraph. */
const LanguageSkillSchema = new Schema(
  {
    language: { type: String, required: true },
    level: { type: String, enum: SKILL_LEVELS, required: true },
    /** 0-1. How much evidence backed this call. */
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
  },
  { _id: false },
);

const SkillGraphSchema = new Schema(
  {
    languageSkills: { type: [LanguageSkillSchema], default: [] },
    overallTier: { type: String, enum: SKILL_LEVELS, required: true },
    summary: { type: String, default: "" },
    /** "ai" when the model produced it, "heuristic" when it fell back. */
    source: { type: String, enum: ["ai", "heuristic"], default: "heuristic" },
    computedAt: { type: Date, default: Date.now },
    /** What the analysis saw, for the profile's "based on" line. */
    evidence: {
      repos: { type: Number, default: 0 },
      commits: { type: Number, default: 0 },
      mergedPrs: { type: Number, default: 0 },
    },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    githubId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, index: true },
    avatarUrl: { type: String, default: "" },
    name: { type: String, default: "" },
    skillLevel: { type: String, enum: SKILL_LEVELS, default: null },
    interests: [{ type: String, enum: INTERESTS }],
    languages: [{ type: String }],
    timeAvailability: { type: String, enum: TIME_AVAILABILITY, default: null },
    /** Languages derived from the user's public repos at first login. */
    suggestedLanguages: [{ type: String }],
    onboardedAt: { type: Date, default: null },
    skillGraph: { type: SkillGraphSchema, default: null },
    /** idle | pending | computing | error. Drives the profile card's state. */
    skillGraphStatus: { type: String, default: "idle" },
    skillGraphError: { type: String, default: "" },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema> & {
  _id: Types.ObjectId;
};

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", UserSchema);
