import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { currentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { Issue, type IssueDoc } from "@/models/Issue";
import { SavedIssue } from "@/models/SavedIssue";
import { RepoMeta } from "@/models/RepoMeta";
import { docToCandidate, docToRepoSignals } from "@/lib/issue-mapper";
import { scoreIssue } from "@/lib/scoring";
import { buildGuideSteps } from "@/lib/guide";
import { SiteHeader } from "@/components/site-header";
import { ShaderBackground } from "@/components/shader-background";
import { IssueDetail } from "@/components/issue-detail";
import { scoreProfileFor } from "@/lib/score-profile";
import type { FeedIssue } from "@/lib/feed-types";

export const dynamic = "force-dynamic";

/**
 * Detail page for an issue in the cache: what it is, why it scored the way it
 * did for this user, and the full guide for that repo, before committing to
 * saving it. Reads only from Mongo, like the feed.
 *
 * If the user already saved it, the guide page with live progress is the
 * better destination, so this redirects there.
 */
export default async function IssuePage({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!user.onboardedAt) redirect("/onboarding");
  if (!mongoose.isValidObjectId(params.id)) notFound();

  await dbConnect();
  const doc = (await Issue.findById(params.id).lean()) as unknown as IssueDoc | null;
  if (!doc) notFound();

  const saved = await SavedIssue.findOne({ userId: user._id, issueUrl: doc.issueUrl })
    .select("_id")
    .lean();
  if (saved) redirect(`/guide/${String(saved._id)}`);

  const meta = await RepoMeta.findOne({ fullName: doc.repoFullName }).select("mentors deepDiveStatus").lean();
  const scored: FeedIssue = {
    ...scoreIssue(docToCandidate(doc), docToRepoSignals(doc), scoreProfileFor(user)),
    cacheId: String(doc._id),
    mentor: meta?.mentors?.[0] ?? null,
  };

  const steps = buildGuideSteps({
    repoName: doc.repoFullName,
    repoUrl: doc.repoUrl,
    cloneUrl: doc.cloneUrl || `${doc.repoUrl}.git`,
    defaultBranch: doc.defaultBranch || "main",
    issueNumber: doc.number,
    issueTitle: doc.title,
    username: user.username,
    hasContributing: doc.hasContributing,
  });

  return (
    <div className="relative min-h-dvh">
      <ShaderBackground opacity={0.18} />
      <SiteHeader />
      <main className="container max-w-5xl py-10">
        <IssueDetail issue={scored} steps={steps} deepDiveAvailable={meta?.deepDiveStatus !== "unavailable"} />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  if (!mongoose.isValidObjectId(params.id)) return { title: "Issue" };
  await dbConnect();
  const doc = await Issue.findById(params.id).select("title repoFullName").lean();
  return { title: doc ? `${doc.title} · ${doc.repoFullName}` : "Issue" };
}
