import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import mongoose from "mongoose";
import { currentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { SavedIssue } from "@/models/SavedIssue";
import { buildGuideSteps } from "@/lib/guide";
import { fetchContributing, getRepoMeta } from "@/lib/github";
import { ContributionGuide } from "@/components/contribution-guide";
import { SiteHeader } from "@/components/site-header";
import { ShaderBackground } from "@/components/shader-background";
import { Button } from "@/components/ui/button";
import type { ContributingSummary } from "@/lib/contributing-types";
import type { SavedIssueRecord } from "@/lib/feed-types";

export const dynamic = "force-dynamic";
export const metadata = { title: "How to contribute" };

export default async function GuidePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!mongoose.isValidObjectId(params.id)) notFound();

  await dbConnect();
  const doc = await SavedIssue.findOne({
    _id: params.id,
    userId: user._id,
  }).lean();
  if (!doc) notFound();

  const issue: SavedIssueRecord = {
    ...doc,
    _id: String(doc._id),
    savedAt: new Date(doc.savedAt).toISOString(),
  } as unknown as SavedIssueRecord;

  // Repo metadata is cached, so this is usually free; CONTRIBUTING.md is not.
  const [meta, contributingFile] = await Promise.all([
    getRepoMeta(issue.repoName),
    fetchContributing(issue.repoName),
  ]);

  const contributing: ContributingSummary = contributingFile
    ? {
        hasContributing: true,
        repoUrl: issue.repoUrl,
        defaultBranch: meta?.defaultBranch ?? issue.defaultBranch,
        hasCodeOfConduct: meta?.hasCodeOfConduct ?? false,
        path: contributingFile.path,
        htmlUrl: contributingFile.htmlUrl,
        summary: contributingFile.summary,
      }
    : {
        hasContributing: false,
        repoUrl: issue.repoUrl,
        defaultBranch: meta?.defaultBranch ?? issue.defaultBranch,
        hasCodeOfConduct: meta?.hasCodeOfConduct ?? false,
      };

  const steps = buildGuideSteps({
    repoName: issue.repoName,
    repoUrl: issue.repoUrl,
    cloneUrl: meta?.cloneUrl || issue.cloneUrl,
    defaultBranch: meta?.defaultBranch || issue.defaultBranch || "main",
    issueNumber: issue.issueNumber,
    issueTitle: issue.issueTitle,
    username: user.username,
    hasContributing: contributing.hasContributing,
    contributingUrl: contributing.htmlUrl,
  });

  return (
    <div className="relative min-h-dvh">
      <ShaderBackground opacity={0.18} />
      <SiteHeader />

      <main className="container max-w-6xl py-10">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 font-mono text-xs text-muted-foreground"
        >
          <Link href="/saved">
            <ArrowLeft className="size-3.5" />
            My list
          </Link>
        </Button>

        <ContributionGuide
          issue={issue}
          steps={steps}
          contributing={contributing}
        />
      </main>
    </div>
  );
}
