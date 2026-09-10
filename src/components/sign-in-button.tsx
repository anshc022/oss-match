"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
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

  return (
    <Button
      size={size}
      className="font-mono"
      disabled={pending}
      onClick={() => {
        setPending(true);
        signIn("github", { callbackUrl: "/onboarding" });
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <GithubMark className="size-4" />
      )}
      {label}
    </Button>
  );
}
