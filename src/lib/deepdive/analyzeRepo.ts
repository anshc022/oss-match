import { z } from "zod";
import { structured } from "@/lib/llm";
import {
  MODULE_CATEGORIES,
  type ArchModule,
  type Connection,
  type IssueLocation,
  type ModuleCategory,
} from "@/lib/deepdive/types";
import type { RepoStructure } from "@/lib/deepdive/collectRepoStructure";

/* ---------------------------------------------------------------- schemas */

export const ArchitectureSchema = z.object({
  architecture: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        name: z.string().max(40),
        description: z.string().max(240),
        filePaths: z.array(z.string()).max(8),
        category: z.enum(MODULE_CATEGORIES),
        layer: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      }),
    )
    .min(2)
    .max(14),
  connections: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().max(40) })).max(30),
  stackSummary: z.string().max(500),
});

export const LocationSchema = z.object({
  moduleIds: z.array(z.string()).min(1).max(3),
  reasoning: z.string().max(500),
});

/* ---------------------------------------------------------------- prompts */

const ARCH_SYSTEM = `You explain unfamiliar codebases to people about to make their first open-source contribution.

You will receive a summary of a repository: its directory layout with file counts and sample file names, the start of its README, and dependency manifests.

Produce a map of the codebase as 5 to 12 modules. A module is a part of the code a newcomer would think of as one thing: "the web pages", "the API routes", "the database layer", "the test suite".

Rules for each module:
- id: short kebab-case, unique.
- name: two to four plain words.
- description: one or two sentences a first-time contributor can understand. No jargon, no acronyms without saying what they mean, no assumptions about what they already know.
- filePaths: up to 8 directory or file paths from the summary that make up this module. Only paths that appear in the summary.
- category: frontend (what users see), backend (server logic and APIs), config (build, tooling, CI, dependencies), tests, or docs.
- layer: 0 if this is where a user or request enters (pages, UI, CLI entry, routes); 2 if it is where data lives or is stored (models, database, schemas, storage); 1 for everything between.

connections: which modules talk to which, as a short verb phrase label such as "calls", "renders", "reads from", "configures". Only between module ids you defined. Keep it to the meaningful ones.

stackSummary: two or three plain sentences saying what this project is, what it is built with, and how it is organised, written for someone who has never opened it.`;

const LOCATION_SYSTEM = `You help a first-time contributor find where in a codebase an issue lives.

You will receive the repository's module map and the text of one issue, plus any file paths the issue mentions.

Choose the one to three modules the contributor will most likely need to touch, and explain why in two or three plain sentences: what the issue is asking for, where that behaviour lives, and what to look at first. Write it to the contributor. Only use module ids from the map.`;

/* ---------------------------------------------------------------- calls */

export async function analyzeArchitectureWithAI(
  s: RepoStructure,
): Promise<z.infer<typeof ArchitectureSchema> | null> {
  // Kept compact on purpose: the configured model's latency scales with input
  // and it reasons at length, so a fat prompt is what pushes it past timeout.
  const summary = {
    repo: s.fullName,
    stack: s.stack,
    totalFiles: s.totalFiles,
    directories: s.dirs.slice(0, 40).map((d) => `${d.path} (${d.files}: ${d.sample.slice(0, 4).join(", ")})`),
    readme: s.readme.slice(0, 1200),
    manifests: Object.fromEntries(
      Object.entries(s.manifests).map(([k, v]) => [k, v.slice(0, 700)]),
    ),
  };
  const out = await structured({
    label: "deepdive:arch",
    reasoningEffort: "low",
    schema: ArchitectureSchema,
    system: ARCH_SYSTEM,
    user: JSON.stringify(summary, null, 1),
    // The configured model reasons at length before emitting JSON; a 6k
    // budget was measured to run out before the object closed.
    maxTokens: 16384,
    // Measured: this model needed more than 150s on a 60-directory prompt.
    // It is a user-triggered background job with staged progress, so waiting
    // is acceptable; the heuristic answers if it still runs over.
    timeoutMs: 240_000,
  });
  if (!out) return null;

  // Ground the result: connections may only reference defined modules.
  const ids = new Set(out.architecture.map((m) => m.id));
  return {
    ...out,
    connections: out.connections.filter((c) => ids.has(c.from) && ids.has(c.to) && c.from !== c.to),
  };
}

export async function locateIssueWithAI(
  modules: ArchModule[],
  issue: { title: string; body: string },
  mentioned: string[],
): Promise<IssueLocation | null> {
  const out = await structured({
    label: "deepdive:issue",
    reasoningEffort: "low",
    schema: LocationSchema,
    system: LOCATION_SYSTEM,
    user: JSON.stringify(
      {
        modules: modules.map((m) => ({ id: m.id, name: m.name, description: m.description, filePaths: m.filePaths })),
        issue: { title: issue.title, body: issue.body.slice(0, 2000) },
        mentionedPaths: mentioned,
      },
      null,
      1,
    ),
    maxTokens: 4096,
    timeoutMs: 90_000,
  });
  if (!out) return null;
  const ids = new Set(modules.map((m) => m.id));
  const moduleIds = out.moduleIds.filter((id) => ids.has(id));
  if (moduleIds.length === 0) return null;
  return { moduleIds, reasoning: out.reasoning, mentionedPaths: mentioned, source: "ai" };
}

/* ------------------------------------------------------------- heuristics */

const CATEGORY_RULES: Array<[RegExp, ModuleCategory, 0 | 1 | 2, string]> = [
  [/^(test|tests|__tests__|spec|e2e|cypress)$/i, "tests", 1, "Automated tests"],
  [/^(docs?|documentation|examples?)$/i, "docs", 0, "Documentation and examples"],
  [/^(\.github|\.circleci|scripts?|tools?|build|config|configs?|infra|docker|ci)$/i, "config", 1, "Build, tooling and CI"],
  [/^(pages|app|views|screens|components|ui|public|static|assets|styles?|www|client|frontend|web)$/i, "frontend", 0, "What users see"],
  [/^(api|routes?|controllers?|handlers?|server|backend|services?|core|internal|cmd|pkg)$/i, "backend", 1, "Server logic"],
  [/^(models?|db|database|schemas?|migrations?|data|store|storage|prisma)$/i, "backend", 2, "Where data is defined and stored"],
  [/^(lib|utils?|helpers?|common|shared|hooks)$/i, "backend", 1, "Shared helpers used across the code"],
];

/** A serviceable map from directory names alone, for when the model is unavailable. */
export function heuristicArchitecture(s: RepoStructure): { architecture: ArchModule[]; connections: Connection[]; stackSummary: string } {
  const top = (s.tree.children ?? []).filter((c) => c.type === "dir");
  // Look one level into `src` because that is where most projects keep everything.
  const src = top.find((c) => c.name === "src");
  const candidates = [...top.filter((c) => c.name !== "src"), ...((src?.children ?? []).filter((c) => c.type === "dir"))]
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 10);

  const architecture: ArchModule[] = candidates.map((dir) => {
    const rule = CATEGORY_RULES.find(([re]) => re.test(dir.name));
    const [, category, layer, blurb] = rule ?? [null, "backend" as ModuleCategory, 1 as const, "Part of the application code"];
    return {
      id: dir.path.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "") || "root",
      name: dir.name,
      description: `${blurb}. ${dir.fileCount} file${dir.fileCount === 1 ? "" : "s"} live under ${dir.path}/.`,
      filePaths: [dir.path],
      category,
      layer,
    };
  });
  if (architecture.length === 0) {
    architecture.push({ id: "root", name: "Project root", description: "The whole project lives at the top level.", filePaths: [""], category: "backend", layer: 1 });
  }

  const connections: Connection[] = [];
  const byLayer = (l: number) => architecture.filter((m) => m.layer === l && m.category !== "tests" && m.category !== "docs");
  for (const a of byLayer(0)) for (const b of byLayer(1).slice(0, 2)) connections.push({ from: a.id, to: b.id, label: "uses" });
  for (const a of byLayer(1)) for (const b of byLayer(2).slice(0, 2)) connections.push({ from: a.id, to: b.id, label: "reads from" });
  for (const t of architecture.filter((m) => m.category === "tests")) for (const b of byLayer(1).slice(0, 1)) connections.push({ from: t.id, to: b.id, label: "tests" });

  const stack = s.stack.length ? s.stack.join(", ") : "the languages in its file list";
  const stackSummary = `This project is built with ${stack}. It has about ${s.totalFiles} files across ${top.length} top-level folders${src ? ", with most code under src/" : ""}. The map below is based on folder names; add an LLM key for a written walkthrough.`;

  return { architecture, connections: connections.slice(0, 20), stackSummary };
}

/** Match mentioned paths to modules; fall back to the entry-layer module. */
export function heuristicLocation(modules: ArchModule[], mentioned: string[]): IssueLocation {
  const hits = new Set<string>();
  for (const p of mentioned) {
    for (const m of modules) {
      if (m.filePaths.some((fp) => fp && (p === fp || p.startsWith(fp.replace(/\/$/, "") + "/")))) hits.add(m.id);
    }
  }
  const moduleIds = Array.from(hits).slice(0, 3);
  if (moduleIds.length === 0) {
    const entry = modules.find((m) => m.layer === 0 && m.category === "frontend") ?? modules.find((m) => m.layer === 0) ?? modules[0];
    if (entry) moduleIds.push(entry.id);
  }
  const named = moduleIds.map((id) => modules.find((m) => m.id === id)?.name ?? id);
  const reasoning = mentioned.length
    ? `The issue mentions ${mentioned.slice(0, 3).join(", ")}, which sit in ${named.join(" and ")}. Start there and follow what those files import.`
    : `The issue does not name specific files, so start at ${named.join(" and ")}, which is where this kind of change usually begins, and search the code for words from the issue title.`;
  return { moduleIds, reasoning, mentionedPaths: mentioned, source: "heuristic" };
}
