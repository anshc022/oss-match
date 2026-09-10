import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
  type Types,
} from "mongoose";
import { ISSUE_STATUSES } from "@/lib/constants";
import { GUIDE_STEPS } from "@/lib/guide";

const SavedIssueSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    issueUrl: { type: String, required: true },
    issueNumber: { type: Number, required: true },
    issueTitle: { type: String, required: true },
    issueBody: { type: String, default: "" },
    repoName: { type: String, required: true },
    repoUrl: { type: String, required: true },
    cloneUrl: { type: String, default: "" },
    defaultBranch: { type: String, default: "main" },
    language: { type: String, default: "" },
    labels: [{ type: String }],
    matchScore: { type: Number, default: 0 },
    status: { type: String, enum: ISSUE_STATUSES, default: "saved" },
    /** Completed step numbers, 1-indexed against GUIDE_STEPS. */
    guideProgress: [{ type: Number, min: 1, max: GUIDE_STEPS.length }],
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// A user saves any given issue at most once.
SavedIssueSchema.index({ userId: 1, issueUrl: 1 }, { unique: true });

export type SavedIssueDoc = InferSchemaType<typeof SavedIssueSchema> & {
  _id: Types.ObjectId;
};

export const SavedIssue: Model<SavedIssueDoc> =
  (models.SavedIssue as Model<SavedIssueDoc>) ??
  model<SavedIssueDoc>("SavedIssue", SavedIssueSchema);
