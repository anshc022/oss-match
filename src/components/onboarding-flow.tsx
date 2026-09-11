"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  COMMON_LANGUAGES,
  INTERESTS,
  INTEREST_COPY,
  SKILL_LEVELS,
  SKILL_LEVEL_COPY,
  TIME_AVAILABILITY,
  TIME_COPY,
  type Interest,
  type SkillLevel,
  type TimeAvailability,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Character } from "@/components/landing/story/voxel-figure";

type Initial = {
  skillLevel: SkillLevel | null;
  interests: Interest[];
  languages: string[];
  timeAvailability: TimeAvailability | null;
};

const STEPS = [
  { key: "skill", title: "How much have you shipped?", hint: "This decides which issue labels get ranked to the top. You can change it later." },
  { key: "interests", title: "What do you want to work on?", hint: "Used to nudge repos whose topics overlap with yours. Pick as many as you like." },
  { key: "languages", title: "Which languages do you write?", hint: "The single heaviest factor in matching. Be honest rather than aspirational." },
  { key: "time", title: "How much time do you have?", hint: "Sets expectations for issue size. Nobody is holding you to it." },
] as const;

export function OnboardingFlow({
  username,
  avatarUrl,
  name,
  initial,
  suggestedLanguages,
  alreadyOnboarded,
}: {
  username: string;
  avatarUrl?: string;
  name?: string;
  initial: Initial;
  suggestedLanguages: string[];
  alreadyOnboarded: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(initial.skillLevel);
  const [interests, setInterests] = useState<Interest[]>(initial.interests);
  const [languages, setLanguages] = useState<string[]>(
    initial.languages.length ? initial.languages : suggestedLanguages,
  );
  const [timeAvailability, setTimeAvailability] = useState<TimeAvailability | null>(
    initial.timeAvailability,
  );
  const [customLanguage, setCustomLanguage] = useState("");

  // Suggestions first, then the standard list, with no duplicates.
  const languageOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const l of [...suggestedLanguages, ...languages, ...COMMON_LANGUAGES]) {
      const key = l.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(l);
    }
    return out;
  }, [suggestedLanguages, languages]);

  const canAdvance =
    (step === 0 && Boolean(skillLevel)) ||
    step === 1 ||
    (step === 2 && languages.length > 0) ||
    (step === 3 && Boolean(timeAvailability));

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skillLevel,
          interests,
          languages,
          timeAvailability,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save your profile");
      toast.success("Profile saved. Building your feed.");
      router.push("/feed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const current = STEPS[step];

  return (
    <div className="w-full max-w-2xl animate-rise-in">
      <div className="mb-6 flex items-center gap-4">
        <Avatar className="size-12 border-2 border-iris/30">
          <AvatarImage src={avatarUrl} alt={username} />
          <AvatarFallback className="font-mono text-xs">{username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-iris">
            <span className="h-px w-6 bg-iris" />
            {alreadyOnboarded ? "preferences" : "welcome"}
          </p>
          <h1 className="mt-1 truncate font-mono text-xl font-semibold tracking-tight sm:text-2xl">
            {alreadyOnboarded ? `Tune your feed, @${username}` : `Hi ${name?.split(" ")[0] || `@${username}`}, let's build your feed.`}
          </h1>
        </div>
        <div className="ml-auto hidden shrink-0 sm:block">
          <Character role="guide" unit={3.6} title="FirstFork, here to set up your feed" />
        </div>
      </div>

    <Card className="w-full border-border/60 bg-card/80 backdrop-blur-xl">
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between">
          <ol className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <li
                key={s.key}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-8 bg-iris" : i < step ? "w-4 bg-iris/50" : "w-4 bg-border",
                )}
              />
            ))}
          </ol>
          <span className="font-mono text-[11px] text-muted-foreground">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <div className="pt-1">
          <CardTitle className="font-mono text-xl tracking-tight">
            {current.title}
          </CardTitle>
          <CardDescription className="pt-2 leading-relaxed">
            {current.hint}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="min-h-[280px]">
        {step === 0 && (
          <RadioGroup
            value={skillLevel ?? ""}
            onValueChange={(v) => setSkillLevel(v as SkillLevel)}
            className="gap-3"
          >
            {SKILL_LEVELS.map((level) => (
              <Label
                key={level}
                htmlFor={level}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-4 transition-colors hover:bg-accent/50",
                  skillLevel === level && "border-primary/60 bg-primary/5",
                )}
              >
                <RadioGroupItem value={level} id={level} className="mt-0.5" />
                <div className="space-y-1">
                  <div className="font-mono text-sm font-medium">
                    {SKILL_LEVEL_COPY[level].label}
                  </div>
                  <p className="text-sm font-normal leading-relaxed text-muted-foreground">
                    {SKILL_LEVEL_COPY[level].hint}
                  </p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        )}

        {step === 1 && (
          <ToggleGroup
            type="multiple"
            value={interests}
            onValueChange={(v) => setInterests(v as Interest[])}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {INTERESTS.map((interest) => (
              <ToggleGroupItem
                key={interest}
                value={interest}
                className="h-auto flex-col items-start gap-1 rounded-lg border border-border/60 p-4 data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
              >
                <span className="font-mono text-sm">
                  {INTEREST_COPY[interest].label}
                </span>
                <span className="text-left text-[11px] font-normal text-muted-foreground">
                  {INTEREST_COPY[interest].topics.slice(0, 3).join(", ")}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {suggestedLanguages.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-primary/25 bg-primary/5 p-3">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  We looked at your public repos and pre-selected{" "}
                  <span className="font-mono text-foreground">
                    {suggestedLanguages.join(", ")}
                  </span>
                  . Untick anything you would rather not be matched on.
                </p>
              </div>
            )}

            <ToggleGroup
              type="multiple"
              value={languages}
              onValueChange={setLanguages}
              className="flex flex-wrap justify-start gap-2"
            >
              {languageOptions.map((lang) => (
                <ToggleGroupItem
                  key={lang}
                  value={lang}
                  size="sm"
                  className="rounded-full border border-border/60 px-3 font-mono text-xs data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                >
                  {lang}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex gap-2">
              <Input
                value={customLanguage}
                onChange={(e) => setCustomLanguage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Add another language"
                className="h-9 font-mono text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addCustom}
                disabled={!customLanguage.trim()}
              >
                Add
              </Button>
            </div>

            <p className="font-mono text-xs text-muted-foreground">
              {languages.length} selected
            </p>
          </div>
        )}

        {step === 3 && (
          <RadioGroup
            value={timeAvailability ?? ""}
            onValueChange={(v) => setTimeAvailability(v as TimeAvailability)}
            className="gap-3"
          >
            {TIME_AVAILABILITY.map((t) => (
              <Label
                key={t}
                htmlFor={t}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-4 transition-colors hover:bg-accent/50",
                  timeAvailability === t && "border-primary/60 bg-primary/5",
                )}
              >
                <RadioGroupItem value={t} id={t} />
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-sm font-medium">
                    {TIME_COPY[t].label}
                  </span>
                  <Badge variant="secondary" className="font-mono text-[11px] font-normal">
                    {TIME_COPY[t].hint}
                  </Badge>
                </div>
              </Label>
            ))}
          </RadioGroup>
        )}
      </CardContent>

      <CardFooter className="justify-between border-t border-border/60 pt-6">
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-xs text-muted-foreground"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {alreadyOnboarded && step < STEPS.length - 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs text-muted-foreground"
              onClick={() => setStep(STEPS.length - 1)}
            >
              Skip to end
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              size="sm"
              className="font-mono"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
            >
              Next
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="font-mono"
              onClick={submit}
              disabled={!canAdvance || saving}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {alreadyOnboarded ? "Save changes" : "Build my feed"}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
    </div>
  );

  function addCustom() {
    const value = customLanguage.trim();
    if (!value) return;
    if (!languages.some((l) => l.toLowerCase() === value.toLowerCase())) {
      setLanguages((prev) => [...prev, value]);
    }
    setCustomLanguage("");
  }
}
