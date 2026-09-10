"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { FeedIssue } from "@/lib/feed-types";

export const PAGE_SIZE = 25;

export type FeedAction = "save" | "skip";

/**
 * Data layer shared by the swipe deck and the list view: paging through the
 * cached feed, the Hacktoberfest filter, and persisting save/skip. Each view
 * decides how to consume the array; the deck keeps an index for undo, the
 * list removes cards as they are acted on.
 */
export function useIssueFeed() {
  const [issues, setIssues] = useState<FeedIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hacktoberfestOnly, setHacktoberfestOnly] = useState(false);
  /** Bumps on every fresh load so views can reset their local cursors. */
  const [generation, setGeneration] = useState(0);
  const inflight = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++inflight.current;
    setIssues(null);
    setError(null);
    setHasMore(false);
    try {
      const params = new URLSearchParams({ page: "1", limit: String(PAGE_SIZE) });
      if (hacktoberfestOnly) params.set("hacktoberfest", "true");
      const res = await fetch(`/api/issues/feed?${params}`);
      if (res.status === 428) {
        window.location.href = "/onboarding";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load your feed");
      // A filter flip mid-request must not let the stale response win.
      if (ticket !== inflight.current) return;
      setIssues(data.issues as FeedIssue[]);
      setHasMore(Boolean(data.page?.hasMore));
      setPage(1);
      setGeneration((g) => g + 1);
    } catch (err) {
      if (ticket !== inflight.current) return;
      setError(err instanceof Error ? err.message : "Could not load your feed");
      setIssues([]);
    }
  }, [hacktoberfestOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(page + 1), limit: String(PAGE_SIZE) });
      if (hacktoberfestOnly) params.set("hacktoberfest", "true");
      const res = await fetch(`/api/issues/feed?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load more");
      const incoming = data.issues as FeedIssue[];
      setIssues((prev) => {
        const known = new Set((prev ?? []).map((i) => i.htmlUrl));
        return [...(prev ?? []), ...incoming.filter((i) => !known.has(i.htmlUrl))];
      });
      setHasMore(Boolean(data.page?.hasMore));
      setPage((p) => p + 1);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, page, hacktoberfestOnly]);

  const persist = useCallback(async (issue: FeedIssue, action: FeedAction) => {
    try {
      const res = await fetch("/api/issues/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          issueUrl: issue.htmlUrl,
          issueNumber: issue.number,
          issueTitle: issue.title,
          issueBody: issue.body,
          repoName: issue.repoFullName,
          repoUrl: issue.repoUrl,
          cloneUrl: issue.repo.cloneUrl,
          defaultBranch: issue.repo.defaultBranch,
          language: issue.repo.language,
          labels: issue.labels,
          matchScore: issue.matchScore,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }
      return true;
    } catch {
      toast.error(
        action === "save" ? "Could not save that issue." : "Could not record that skip.",
      );
      return false;
    }
  }, []);

  /** Drop one issue from the local array; used by the list view after acting. */
  const remove = useCallback((issueUrl: string) => {
    setIssues((prev) => (prev ? prev.filter((i) => i.htmlUrl !== issueUrl) : prev));
  }, []);

  return {
    issues,
    error,
    hasMore,
    loadingMore,
    hacktoberfestOnly,
    setHacktoberfestOnly,
    generation,
    load,
    loadMore,
    persist,
    remove,
  };
}

export type IssueFeed = ReturnType<typeof useIssueFeed>;
