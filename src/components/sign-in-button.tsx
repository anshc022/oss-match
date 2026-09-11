"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { GithubMark } from "@/components/github-mark";

export function SignInButton({
  size = "lg",
  label = "Continue with GitHub",
}: {
  size?: "sm" | "lg" | "default";
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [demo, setDemo] = useState(false);

  // Demo mode is a server-side decision, so the button asks which providers
  // are actually configured rather than reading an environment variable that
  // the browser cannot see.
  useEffect(() => {
    let live = true;
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (live && p) setDemo(Boolean(p.demo));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <Button
      size={size}
      className="font-mono"
      disabled={pending}
      onClick={() => {
        setPending(true);
        signIn(demo ? "demo" : "github", { callbackUrl: "/onboarding" });
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <GithubMark className="size-4" />
      )}
      {demo ? "Continue with the demo account" : label}
    </Button>
  );
}
