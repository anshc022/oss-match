import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/mongodb";
import { SavedIssue } from "@/models/SavedIssue";
import { GUIDE_STEPS } from "@/lib/guide";
import { SiteHeader } from "@/components/site-header";
import { ShaderBackground } from "@/components/shader-background";
import { PageHeader } from "@/components/page-header";
import { SavedEmpty, SavedList } from "@/components/saved-list";
import { Button } from "@/components/ui/button";
import type { SavedIssueRecord } from "@/lib/feed-types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My list" };

export default async function SavedPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  await dbConnect();
  const docs = await SavedIssue.find({ userId: user._id }).sort({ savedAt: -1 }).lean();

  const issues: SavedIssueRecord[] = docs.map((d) => ({
    ...d,
    _id: String(d._id),
    savedAt: new Date(d.savedAt).toISOString(),
    totalSteps: GUIDE_STEPS.length,
  })) as unknown as SavedIssueRecord[];

  return (
    <div className="relative min-h-dvh">
      <ShaderBackground opacity={0.2} />
      <SiteHeader />

      <main className="container max-w-4xl py-10">
        <PageHeader
          eyebrow="my list"
          title="Issues you kept"
          description="Every saved issue with how far you got on its guide. Finish all eight steps and you can mark it contributed."
          actions={
            <Button asChild variant="outline" size="sm" className="font-mono text-xs">
              <Link href="/feed">
                <Layers className="size-3.5" />
                Back to feed
              </Link>
            </Button>
          }
        />

        {issues.length === 0 ? <SavedEmpty /> : <SavedList issues={issues} />}
      </main>
    </div>
  );
}
