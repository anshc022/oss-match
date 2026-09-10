"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Blocks, LogOut, Bookmark, Layers, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/feed", label: "Feed", icon: Layers },
  { href: "/saved", label: "My list", icon: Bookmark },
];

export function SiteHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-14 items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <Blocks className="size-5 text-primary" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            oss<span className="text-primary">/</span>match
          </span>
        </Link>

        {session?.user && (
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "font-mono text-xs text-muted-foreground",
                  pathname.startsWith(item.href) && "bg-accent text-foreground",
                )}
              >
                <Link href={item.href}>
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="size-7">
                    <AvatarImage
                      src={session.user.avatarUrl || session.user.image || ""}
                      alt={session.user.username}
                    />
                    <AvatarFallback className="font-mono text-xs">
                      {session.user.username?.slice(0, 2).toUpperCase() ?? "??"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-mono text-xs">
                  @{session.user.username}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/u/${session.user.username}`}>
                    <UserIcon className="size-3.5" />
                    Public profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/onboarding">
                    <Layers className="size-3.5" />
                    Edit preferences
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                  <LogOut className="size-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}
