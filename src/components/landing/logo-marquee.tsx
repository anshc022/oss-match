import {
  siTypescript, siJavascript, siPython, siGo, siRust, siOpenjdk, siCplusplus,
  siRuby, siPhp, siSwift, siKotlin, siDart, siElixir, siScala, siHaskell,
  siLua, siSolidity,
  siReact, siNextdotjs, siVuedotjs, siSvelte, siAngular, siNodedotjs, siDeno,
  siBun, siDjango, siFlask, siFastapi, siPytorch, siTensorflow, siDocker,
  siKubernetes, siTerraform, siPostgresql, siMongodb, siTailwindcss, siVite,
  type SimpleIcon,
} from "simple-icons";
import { BrandIcon } from "@/components/landing/brand-icon";
import { cn } from "@/lib/utils";

/**
 * Two counter-scrolling rows of real marks: the languages the fetcher indexes
 * and the frameworks those repos are built with. Server-rendered, so the
 * icon paths never reach the client bundle.
 */

const LANGUAGES: SimpleIcon[] = [
  siTypescript, siJavascript, siPython, siGo, siRust, siOpenjdk, siCplusplus,
  siRuby, siPhp, siSwift, siKotlin, siDart, siElixir, siScala, siHaskell,
  siLua, siSolidity,
];

const FRAMEWORKS: SimpleIcon[] = [
  siReact, siNextdotjs, siVuedotjs, siSvelte, siAngular, siNodedotjs, siDeno,
  siBun, siDjango, siFlask, siFastapi, siPytorch, siTensorflow, siDocker,
  siKubernetes, siTerraform, siPostgresql, siMongodb, siTailwindcss, siVite,
];

export function LogoMarquee() {
  return (
    <div
      className="relative overflow-hidden border-y border-border/70 py-4 [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]"
      aria-label="Languages and frameworks FirstFork indexes"
    >
      <Row icons={LANGUAGES} />
      <Row icons={FRAMEWORKS} reverse className="mt-3" />
    </div>
  );
}

function Row({ icons, reverse, className }: { icons: SimpleIcon[]; reverse?: boolean; className?: string }) {
  const doubled = [...icons, ...icons];
  return (
    <div className={cn("flex w-max", className)}>
      <ul
        className={cn(
          "flex shrink-0 items-center gap-3 pr-3 animate-marquee",
          reverse && "[animation-direction:reverse]",
        )}
      >
        {doubled.map((icon, i) => (
          <li
            key={`${icon.slug}-${i}`}
            className="group flex items-center gap-2 whitespace-nowrap rounded-full border border-border/70 bg-card/70 py-1.5 pl-2.5 pr-3.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-[var(--brand)] hover:text-foreground"
          >
            <BrandIcon
              icon={icon}
              className="size-3.5 transition-colors group-hover:[fill:var(--brand)]"
            />
            {icon.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
