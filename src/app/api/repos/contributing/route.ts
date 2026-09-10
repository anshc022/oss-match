import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchContributing, getRepoMeta } from "@/lib/github";

export const dynamic = "force-dynamic";

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo || !REPO_RE.test(repo)) {
    return NextResponse.json(
      { error: "repo must be in owner/name form" },
      { status: 400 },
    );
  }

  const [meta, contributing] = await Promise.all([
    getRepoMeta(repo),
    fetchContributing(repo),
  ]);

  if (!contributing) {
    return NextResponse.json({
      hasContributing: false,
      repoUrl: `https://github.com/${repo}`,
      defaultBranch: meta?.defaultBranch ?? "main",
      hasCodeOfConduct: meta?.hasCodeOfConduct ?? false,
    });
  }

  return NextResponse.json({
    hasContributing: true,
    repoUrl: `https://github.com/${repo}`,
    defaultBranch: meta?.defaultBranch ?? "main",
    hasCodeOfConduct: meta?.hasCodeOfConduct ?? false,
    path: contributing.path,
    htmlUrl: contributing.htmlUrl,
    summary: contributing.summary,
  });
}
