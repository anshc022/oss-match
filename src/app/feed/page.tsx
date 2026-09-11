import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { ShaderBackground } from "@/components/shader-background";
import { FeedView } from "@/components/feed-view";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { hacktoberfestMode } from "@/lib/fetcher/queries";
import { Character } from "@/components/landing/story/voxel-figure";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your feed" };

export default async function FeedPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="relative min-h-dvh">
      <ShaderBackground opacity={0.25} />
      <SiteHeader />

      <main className="container py-10">
        <div className="mx-auto max-w-5xl">
          <PageHeader
            eyebrow="feed"
            title="Matched for you"
            description="Ranked against your languages, level and interests. Save what looks right; skip the rest."
            figure={<Character role="crown" unit={4.4} title="Match score: scores every issue for you" />}
          >
            {(user.languages ?? []).slice(0, 6).map((lang) => (
              <Badge
                key={lang}
                variant="outline"
                className="rounded-full border-border/60 font-mono text-[10px] font-normal text-muted-foreground"
              >
                {lang}
              </Badge>
            ))}
            <Badge
              variant="outline"
              className="rounded-full border-iris/30 bg-iris/5 font-mono text-[10px] font-normal text-iris"
            >
              {user.skillLevel}
            </Badge>
            {user.skillGraph?.overallTier && (
              <Badge
                variant="outline"
                className="rounded-full border-neon/40 bg-neon/10 font-mono text-[10px] font-normal text-neon"
                title="Computed from your GitHub activity"
              >
                computed: {user.skillGraph.overallTier}
              </Badge>
            )}
            {hacktoberfestMode() && (
              <Badge
                variant="outline"
                className="rounded-full border-amber/40 bg-amber/10 font-mono text-[10px] font-normal text-amber"
              >
                hacktoberfest season
              </Badge>
            )}
          </PageHeader>
        </div>

        <FeedView hacktoberfestMode={hacktoberfestMode()} />
      </main>
    </div>
  );
}
