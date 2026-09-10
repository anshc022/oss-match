import type { ScoredIssue } from "@/lib/scoring";

export type FeedMentor = { username: string; avatarUrl: string; reason: string };

/**
 * A scored issue as served by the feed. `cacheId` addresses its detail page;
 * `mentor` is the top suggested contact for its repo, when one is cached.
 */
export type FeedIssue = ScoredIssue & { cacheId?: string; mentor?: FeedMentor | null };

export type SavedIssueRecord = {
  _id: string;
  issueUrl: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  repoName: string;
  repoUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  language: string;
  labels: string[];
  matchScore: number;
  status: "saved" | "in-progress" | "contributed";
  guideProgress: number[];
  savedAt: string;
  totalSteps?: number;
};
