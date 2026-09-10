import { createHash } from "node:crypto";
import type { CandidateIssue } from "@/lib/github";

/**
 * Fingerprint of a result set. Covers issue identity plus the fields that
 * drive scoring, so a comment count or edit still counts as a change while
 * pure reordering does not.
 */
export function hashResults(items: CandidateIssue[]): string {
  const material = items
    .map((i) => `${i.id}:${i.updatedAt}:${i.comments}:${i.assigned ? 1 : 0}:${i.labels.slice().sort().join(",")}`)
    .sort()
    .join("|");
  return createHash("sha1").update(material).digest("hex");
}
