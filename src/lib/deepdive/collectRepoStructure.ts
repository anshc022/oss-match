import type { Octokit } from "octokit";
import { RateLimitedQueue } from "@/lib/fetcher/limiter";
import type { TreeNode } from "@/lib/deepdive/types";

/**
 * Everything the analysis needs about a repo, in as few calls as possible:
 * the full file tree in one Git Trees request, the README, and whichever
 * dependency manifests actually exist. Roughly 3-5 API calls per repo.
 */

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", "vendor", "target",
  "coverage", "__pycache__", ".venv", "venv", ".cache", ".turbo", "tmp",
]);
const MAX_DEPTH = 2;
/** Beyond this many entries the tree is cut to top-level + two levels. */
const LARGE_REPO = 1500;
/** Cap on nodes kept after pruning, so the SVG stays drawable. */
const MAX_NODES = 320;

const MANIFESTS = [
  "package.json", "requirements.txt", "pyproject.toml", "go.mod", "Cargo.toml",
  "pom.xml", "build.gradle", "Gemfile", "composer.json", "setup.py",
];

export type RepoStructure = {
  fullName: string;
  defaultBranch: string;
  tree: TreeNode;
  totalFiles: number;
  truncated: boolean;
  readme: string;
  manifests: Record<string, string>;
  stack: string[];
  /** Flat list of directory paths, for the analysis prompt. */
  dirs: { path: string; files: number; sample: string[] }[];
  accessible: boolean;
};

type Entry = { path: string; type: string };

export async function collectRepoStructure(
  fullName: string,
  defaultBranch: string,
  octokit: Octokit,
  queue: RateLimitedQueue,
): Promise<RepoStructure | null> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) return null;

  const treeRes = await queue.run(
    () =>
      octokit.rest.git
        .getTree({ owner, repo, tree_sha: defaultBranch, recursive: "1" })
        .then((r) => ({ ok: true as const, entries: r.data.tree as Entry[], truncated: Boolean(r.data.truncated) }))
        .catch((e: { status?: number }) => ({ ok: false as const, status: e.status ?? 0 })),
    "core",
  );
  if (!treeRes) return null;
  if (!treeRes.ok) {
    // 404 covers private, deleted and renamed repos alike; 409 is an empty repo.
    return { ...empty(fullName, defaultBranch), accessible: treeRes.status !== 404 && treeRes.status !== 409 && treeRes.status !== 403 };
  }

  const entries = treeRes.entries.filter((e) => !isSkipped(e.path));
  const files = entries.filter((e) => e.type === "blob");
  const large = entries.length > LARGE_REPO || treeRes.truncated;
  const tree = buildTree(entries, large ? MAX_DEPTH : MAX_DEPTH + 1);

  const present = new Set(files.map((f) => f.path));
  const wanted = MANIFESTS.filter((m) => present.has(m)).slice(0, 3);
  const manifests: Record<string, string> = {};
  for (const path of wanted) {
    const text = await queue.run(
      () =>
        octokit.rest.repos
          .getContent({ owner, repo, path })
          .then((r) => {
            const d = r.data;
            return !Array.isArray(d) && d.type === "file" && d.content
              ? Buffer.from(d.content, "base64").toString("utf8").slice(0, 4000)
              : "";
          })
          .catch(() => ""),
      "core",
    );
    if (text) manifests[path] = text;
  }

  const readme =
    (await queue.run(
      () =>
        octokit.rest.repos
          .getReadme({ owner, repo })
          .then((r) => Buffer.from(r.data.content, "base64").toString("utf8").slice(0, 2500))
          .catch(() => ""),
      "core",
    )) ?? "";

  return {
    fullName,
    defaultBranch,
    tree,
    totalFiles: files.length,
    truncated: large,
    readme,
    manifests,
    stack: detectStack(manifests, files.map((f) => f.path)),
    dirs: summarizeDirs(files.map((f) => f.path)),
    accessible: true,
  };
}

function empty(fullName: string, defaultBranch: string): RepoStructure {
  return {
    fullName, defaultBranch,
    tree: { name: fullName.split("/")[1] ?? fullName, path: "", type: "dir", children: [], fileCount: 0 },
    totalFiles: 0, truncated: false, readme: "", manifests: {}, stack: [], dirs: [], accessible: false,
  };
}

function isSkipped(path: string) {
  return path.split("/").some((seg) => SKIP_DIRS.has(seg));
}

/** Nested tree cut at `maxDepth`, then capped by node count (largest dirs kept). */
export function buildTree(entries: Entry[], maxDepth: number): TreeNode {
  const root: TreeNode = { name: "", path: "", type: "dir", children: [], fileCount: 0 };
  const index = new Map<string, TreeNode>([["", root]]);

  for (const e of entries) {
    const parts = e.path.split("/");
    let parent = root;
    for (let i = 0; i < parts.length; i++) {
      const path = parts.slice(0, i + 1).join("/");
      const last = i === parts.length - 1;
      const type = last && e.type === "blob" ? "file" : "dir";
      let node = index.get(path);
      if (!node) {
        node = { name: parts[i], path, type, fileCount: 0, ...(type === "dir" ? { children: [] } : {}) };
        index.set(path, node);
        parent.children!.push(node);
      }
      parent = node;
    }
    // Count the file on every ancestor.
    for (let i = 0; i < parts.length - 1; i++) {
      const anc = index.get(parts.slice(0, i + 1).join("/"));
      if (anc) anc.fileCount += 1;
    }
    root.fileCount += 1;
  }

  // Prune depth: past maxDepth, keep the dir but drop its children.
  const prune = (n: TreeNode, depth: number) => {
    if (!n.children) return;
    if (depth >= maxDepth) { n.children = []; return; }
    n.children.sort((a, b) => (a.type === b.type ? b.fileCount - a.fileCount || a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    for (const c of n.children) prune(c, depth + 1);
  };
  prune(root, 0);

  // Cap node count: trim the smallest leaf-files first, deepest first.
  let count = countNodes(root);
  if (count > MAX_NODES) {
    const trim = (n: TreeNode, depth: number) => {
      if (!n.children || count <= MAX_NODES) return;
      for (const c of n.children) trim(c, depth + 1);
      if (count <= MAX_NODES) return;
      const files = n.children.filter((c) => c.type === "file");
      if (files.length > 6) {
        const keep = files.slice(0, 6);
        const dropped = files.length - 6;
        n.children = [...n.children.filter((c) => c.type === "dir"), ...keep, {
          name: `… ${dropped} more files`, path: `${n.path}/…`, type: "file", fileCount: 0,
        }];
        count -= dropped - 1;
      }
    };
    trim(root, 0);
  }
  return root;
}

function countNodes(n: TreeNode): number {
  return 1 + (n.children?.reduce((s, c) => s + countNodes(c), 0) ?? 0);
}

/** Directory summary for the prompt: path, file count, a few file names. */
function summarizeDirs(paths: string[]) {
  const byDir = new Map<string, string[]>();
  for (const p of paths) {
    const parts = p.split("/");
    const dir = parts.length > 1 ? parts.slice(0, Math.min(parts.length - 1, 3)).join("/") : ".";
    (byDir.get(dir) ?? byDir.set(dir, []).get(dir)!).push(parts[parts.length - 1]);
  }
  return Array.from(byDir.entries())
    .map(([path, files]) => ({ path, files: files.length, sample: files.slice(0, 5) }))
    .sort((a, b) => b.files - a.files)
    .slice(0, 60);
}

/** Cheap stack detection from manifests and file extensions. */
export function detectStack(manifests: Record<string, string>, paths: string[]): string[] {
  const out = new Set<string>();
  const pkg = manifests["package.json"];
  if (pkg) {
    const has = (n: string) => new RegExp(`"${n.replace("/", "\\/")}"\\s*:`).test(pkg);
    if (has("next")) out.add("Next.js");
    if (has("react")) out.add("React");
    if (has("vue")) out.add("Vue");
    if (has("svelte")) out.add("Svelte");
    if (has("express")) out.add("Express");
    if (has("typescript") || paths.some((p) => p.endsWith(".ts") || p.endsWith(".tsx"))) out.add("TypeScript");
    else out.add("JavaScript");
    if (has("tailwindcss")) out.add("Tailwind CSS");
    if (has("prisma")) out.add("Prisma");
    if (has("mongoose")) out.add("MongoDB");
    if (has("vitest") || has("jest")) out.add("Jest/Vitest");
  }
  if (manifests["requirements.txt"] || manifests["pyproject.toml"] || manifests["setup.py"]) {
    out.add("Python");
    const py = (manifests["requirements.txt"] ?? "") + (manifests["pyproject.toml"] ?? "");
    if (/django/i.test(py)) out.add("Django");
    if (/flask/i.test(py)) out.add("Flask");
    if (/fastapi/i.test(py)) out.add("FastAPI");
    if (/torch|tensorflow/i.test(py)) out.add("ML");
  }
  if (manifests["go.mod"]) out.add("Go");
  if (manifests["Cargo.toml"]) out.add("Rust");
  if (manifests["pom.xml"] || manifests["build.gradle"]) out.add("Java");
  if (manifests["Gemfile"]) out.add("Ruby");
  if (manifests["composer.json"]) out.add("PHP");
  if (paths.some((p) => /^(Dockerfile|docker-compose\.ya?ml)$/.test(p))) out.add("Docker");
  if (paths.some((p) => p.startsWith(".github/workflows/"))) out.add("GitHub Actions");
  return Array.from(out);
}

/** File paths an issue body mentions that exist in the repo. */
export function mentionedPaths(issueText: string, allPaths: string[]): string[] {
  const candidates = new Set<string>();
  const re = /[\w@./-]+\.(?:tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|rb|php|swift|c|cpp|h|hpp|cs|md|json|ya?ml|toml|css|scss|html|vue|svelte|sql|sh)\b/g;
  for (const m of issueText.matchAll(re)) candidates.add(m[0].replace(/^[./]+/, ""));
  const out: string[] = [];
  for (const c of candidates) {
    const hit = allPaths.find((p) => p === c || p.endsWith(`/${c}`));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out.slice(0, 8);
}
