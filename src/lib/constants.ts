export const SKILL_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const TIME_AVAILABILITY = ["casual", "regular", "serious"] as const;
export type TimeAvailability = (typeof TIME_AVAILABILITY)[number];

export const ISSUE_STATUSES = ["saved", "in-progress", "contributed"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const INTERESTS = [
  "web",
  "ml",
  "web3",
  "mobile",
  "backend",
  "devops",
] as const;
export type Interest = (typeof INTERESTS)[number];

export const SKILL_LEVEL_COPY: Record<
  SkillLevel,
  { label: string; hint: string }
> = {
  beginner: {
    label: "Beginner",
    hint: "New to open source. I want hand-holding and small, well-scoped issues.",
  },
  intermediate: {
    label: "Intermediate",
    hint: "I ship code regularly. I can read an unfamiliar codebase with some effort.",
  },
  advanced: {
    label: "Advanced",
    hint: "Comfortable anywhere. Give me meaty work, not typo fixes.",
  },
};

export const TIME_COPY: Record<
  TimeAvailability,
  { label: string; hint: string }
> = {
  casual: { label: "Casual", hint: "An hour or two a week" },
  regular: { label: "Regular", hint: "A few evenings a week" },
  serious: { label: "Serious", hint: "This is my main side project" },
};

export const INTEREST_COPY: Record<
  Interest,
  { label: string; topics: string[] }
> = {
  web: { label: "Web", topics: ["web", "frontend", "react", "vue", "css", "nextjs", "svelte"] },
  ml: { label: "Machine Learning", topics: ["machine-learning", "deep-learning", "nlp", "ai", "pytorch", "tensorflow"] },
  web3: { label: "Web3", topics: ["blockchain", "ethereum", "solidity", "web3", "cryptocurrency"] },
  mobile: { label: "Mobile", topics: ["android", "ios", "flutter", "react-native", "mobile", "swift"] },
  backend: { label: "Backend", topics: ["api", "database", "backend", "server", "microservices", "graphql"] },
  devops: { label: "DevOps", topics: ["devops", "kubernetes", "docker", "ci", "infrastructure", "terraform"] },
};

/**
 * Languages offered in onboarding. Values are GitHub's own language names so
 * they can be passed straight into the search API's `language:` qualifier.
 */
export const COMMON_LANGUAGES = [
  "JavaScript", "TypeScript", "Python", "Go", "Rust", "Java", "C++", "C#",
  "Ruby", "PHP", "Swift", "Kotlin", "C", "Dart", "Scala", "Elixir", "Shell",
  "HTML", "CSS", "Solidity", "Lua", "R", "Julia", "Haskell",
] as const;

/**
 * Labels we search for. Together they cover the curated newcomer pools and the
 * broader "help wanted" backlog; difficulty scoring sorts out which fits whom.
 */
export const LABEL_QUERIES = [
  "good first issue",
  "help wanted",
  "beginner-friendly",
  "good-first-issue",
  "first-timers-only",
] as const;

/** How long a scored feed page stays warm before we re-hit GitHub. */
export const FEED_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
