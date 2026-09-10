import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
  type Types,
} from "mongoose";

/**
 * Skips are kept so the feed never shows the same card twice. They expire
 * after 60 days, letting a stale skip come back around eventually.
 */
const SkippedIssueSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  issueUrl: { type: String, required: true },
  skippedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 60 },
});

SkippedIssueSchema.index({ userId: 1, issueUrl: 1 }, { unique: true });

export type SkippedIssueDoc = InferSchemaType<typeof SkippedIssueSchema> & {
  _id: Types.ObjectId;
};

export const SkippedIssue: Model<SkippedIssueDoc> =
  (models.SkippedIssue as Model<SkippedIssueDoc>) ??
  model<SkippedIssueDoc>("SkippedIssue", SkippedIssueSchema);
