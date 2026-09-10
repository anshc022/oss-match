"use client";

import Link from "next/link";
import { Blocks } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignInButton } from "@/components/sign-in-button";

export function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Blocks className="size-5 text-iris" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            oss<span className="text-iris">/</span>match
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignInButton size="sm" label="Sign in" />
        </div>
      </div>
    </header>
  );
}
