import { MessageCircleQuestion } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FeedMentor } from "@/lib/feed-types";
import { cn } from "@/lib/utils";

/**
 * The one-line form of a suggested contact, for feed cards and rows: who to
 * ask and the one factual reason. Links to their GitHub profile.
 */
export function MentorLine({
  mentor,
  className,
  compact,
  bold,
}: {
  mentor: FeedMentor;
  className?: string;
  compact?: boolean;
  /** Larger form for the swipe card, where it is the first thing under the title. */
  bold?: boolean;
}) {
  if (bold) {
    return (
      <a
        href={`https://github.com/${mentor.username}`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex items-center gap-3 rounded-xl border border-neon/40 bg-neon/10 px-3 py-2 transition-colors hover:border-neon/70",
          className,
        )}
      >
        <Avatar className="size-8 shrink-0 border-2 border-neon/60">
          <AvatarImage src={mentor.avatarUrl} alt={mentor.username} />
          <AvatarFallback className="font-mono text-[10px]">{mentor.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[12px] leading-tight">
            <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-neon">
              <MessageCircleQuestion className="size-3" />
              ask
            </span>
            <span className="truncate font-semibold">@{mentor.username}</span>
          </p>
          <p className="line-clamp-1 text-[11px] leading-snug text-muted-foreground">{mentor.reason}</p>
        </div>
      </a>
    );
  }
  return (
    <a
      href={`https://github.com/${mentor.username}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "group/mentor flex items-center gap-2 rounded-lg border border-neon/25 bg-neon/5 px-2.5 py-1.5 transition-colors hover:border-neon/50",
        className,
      )}
    >
      <MessageCircleQuestion className="size-3.5 shrink-0 text-neon" />
      <Avatar className={cn("shrink-0 border border-border/60", compact ? "size-4" : "size-5")}>
        <AvatarImage src={mentor.avatarUrl} alt={mentor.username} />
        <AvatarFallback className="font-mono text-[8px]">{mentor.username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate font-mono text-[11px]">
        <span className="text-neon">ask @{mentor.username}</span>
        {!compact && <span className="text-muted-foreground"> · {mentor.reason}</span>}
      </span>
    </a>
  );
}
