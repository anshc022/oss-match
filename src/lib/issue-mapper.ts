import type { CandidateIssue, RepoSignals } from "@/lib/github";
import type { IssueDoc } from "@/models/Issue";

/**
 * Adapters between the serving collection and the scoring module.
 *
 * The issue document stores every input the scorer needs, so the per-user
 * factors can be applied by calling the existing `scoreIssue` on a document
 * already in memory. No API call, no second query, and no second copy of the
 * weight maths.
 */

export function docToCandidate(doc: IssueDoc): CandidateIssue {
  return {
    id: doc.githubId,
    number: doc.number,
    title: doc.title,
    body: doc.body ?? "",
    htmlUrl: doc.issueUrl,
    repoFullName: doc.repoFullName,
    repoUrl: doc.repoUrl,
    labels: doc.labels ?? [],
    comments: doc.comments ?? 0,
    createdAt: new Date(doc.issueCreatedAt).toISOString(),
    updatedAt: new Date(doc.issueUpdatedAt).toISOString(),
    hasLinkedPr: Boolean(doc.hasLinkedPr),
    assigned: Boolean(doc.assigned),
    language: doc.language ?? "",
  };
}

export function docToRepoSignals(doc: IssueDoc): RepoSignals {
  return {
    fullName: doc.repoFullName,
    etag: "",
    stars: doc.stars ?? 0,
    forks: doc.forks ?? 0,
    openIssues: 0,
    pushedAt: doc.pushedAt ? new Date(doc.pushedAt) : null,
    language: doc.language ?? "",
    topics: doc.topics ?? [],
    defaultBranch: doc.defaultBranch || "main",
    cloneUrl: doc.cloneUrl || `https://github.com/${doc.repoFullName}.git`,
    hasContributing: Boolean(doc.hasContributing),
    contributingPath: "",
    hasCodeOfConduct: Boolean(doc.hasCodeOfConduct),
    hasCi: Boolean(doc.hasCi),
    archived: Boolean(doc.archived),
    fetchedAt: new Date(doc.lastScoredAt),
  };
}
