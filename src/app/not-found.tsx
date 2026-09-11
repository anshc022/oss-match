import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Character } from "@/components/landing/story/voxel-figure";
import { ShaderBackground } from "@/components/shader-background";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="relative min-h-dvh">
      <ShaderBackground opacity={0.3} />
      <SiteHeader />
      <main className="container flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <Character role="newcomer" unit={7} title="A developer who has opened one tab too many" />
        <p className="mt-6 font-hand text-2xl text-muted-foreground" style={{ transform: "rotate(-2deg)" }}>
          Wrong tab.
        </p>
        <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">There is nothing at this address.</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          The issue may have been removed from the index, or the link was copied short. The feed is still where it was.
        </p>
        <div className="mt-6 flex gap-2">
          <Button asChild className="font-mono">
            <Link href="/feed">Open the feed</Link>
          </Button>
          <Button asChild variant="outline" className="font-mono">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
