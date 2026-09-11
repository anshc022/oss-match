"use client";

import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignInButton } from "@/components/sign-in-button";

export function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="size-5" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            {BRAND.wordmark.lead}<span className="text-iris">/</span>{BRAND.wordmark.tail}
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
