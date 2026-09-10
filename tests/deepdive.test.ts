import { test } from "node:test";
import assert from "node:assert/strict";
import { ancestorsOf, bounds, isHighlighted, layoutIso, project, ROOT_WRAP, ROW_GAP } from "../src/lib/deepdive/iso-layout";
import { buildTree, detectStack, mentionedPaths } from "../src/lib/deepdive/collectRepoStructure";
import { heuristicArchitecture, heuristicLocation } from "../src/lib/deepdive/analyzeRepo";
import type { RepoStructure } from "../src/lib/deepdive/collectRepoStructure";
import type { TreeNode } from "../src/lib/deepdive/types";

const entries = [
  "README.md", "package.json",
  "src/index.ts", "src/app/page.tsx", "src/app/layout.tsx", "src/components/button.tsx",
  "src/lib/db.ts", "src/lib/deep/er/nested.ts",
  "tests/a.test.ts", "docs/guide.md", ".github/workflows/ci.yml",
  "node_modules/left-pad/index.js",
].map((path) => ({ path, type: "blob" }));

test("buildTree nests by path, counts files on ancestors, and respects depth", () => {
  const tree = buildTree(entries.filter((e) => !e.path.startsWith("node_modules")), 2);
  const src = tree.children!.find((c) => c.name === "src")!;
  assert.equal(src.type, "dir");
  assert.equal(src.fileCount, 6, "every file under src is counted on src");
  const lib = src.children!.find((c) => c.name === "lib")!;
  assert.equal(lib.fileCount, 2, "counted before the depth cut");
  // Depth 2 cut: lib sits at depth 2, so it is drawn as a leaf block.
  assert.deepEqual(lib.children, []);
  assert.equal(tree.fileCount, 11);
});

test("directories sort before files, larger directories first", () => {
  const tree = buildTree(entries, 3);
  const names = tree.children!.map((c) => c.name);
  assert.equal(tree.children![0].type, "dir");
  assert.ok(names.indexOf("src") < names.indexOf("README.md"));
});

test("detectStack reads manifests and file extensions", () => {
  const stack = detectStack({ "package.json": '{"dependencies":{"next":"14","react":"18","tailwindcss":"3"}}' }, ["src/a.tsx", ".github/workflows/ci.yml", "Dockerfile"]);
  for (const s of ["Next.js", "React", "TypeScript", "Tailwind CSS", "Docker", "GitHub Actions"]) assert.ok(stack.includes(s), `missing ${s}`);
  assert.ok(detectStack({ "go.mod": "module x" }, []).includes("Go"));
  assert.ok(detectStack({ "requirements.txt": "django==4\n" }, []).includes("Django"));
});

test("mentionedPaths only returns paths that exist in the tree", () => {
  const all = ["src/app/page.tsx", "src/lib/db.ts", "docs/guide.md"];
  const found = mentionedPaths("The bug is in page.tsx and also ./src/lib/db.ts, not in ghost.ts", all);
  assert.deepEqual(found, ["src/app/page.tsx", "src/lib/db.ts"]);
});

function tree(): TreeNode {
  return buildTree(entries.filter((e) => !e.path.startsWith("node_modules")), 3);
}

test("isometric layout wraps collapsed top-level entries into bands", () => {
  const nodes = layoutIso(tree(), new Set());
  assert.ok(nodes.every((n) => n.depth === 0));
  assert.ok(nodes.every((n) => n.row % ROW_GAP === 0), "root entries sit on band rows only");
  const firstBand = nodes.filter((n) => n.row === 0).map((n) => n.col).sort((a, b) => a - b);
  assert.ok(firstBand.length <= ROOT_WRAP);
  assert.deepEqual(firstBand, firstBand.map((_, i) => i), "one column per entry, no gaps");
});

test("a wide root wraps onto a second band", () => {
  const wide = buildTree(Array.from({ length: ROOT_WRAP + 3 }, (_, i) => ({ path: `f${i}.ts`, type: "blob" })), 2);
  const nodes = layoutIso(wide, new Set());
  assert.equal(nodes.filter((n) => n.row === ROW_GAP).length, 3, "overflow entries land on the next band");
});

test("expanding a folder raises its children one row back and shifts siblings", () => {
  const collapsed = layoutIso(tree(), new Set());
  const expanded = layoutIso(tree(), new Set(["src"]));
  const src = expanded.find((n) => n.key === "src")!;
  const kids = expanded.filter((n) => n.node.path.startsWith("src/") && n.node.path.split("/").length === 2);
  assert.ok(kids.length > 0);
  assert.ok(kids.every((k) => k.row === 1 && k.depth === 1), "children sit one row back and one level up");
  assert.equal(src.span, kids.length, "the parent spans its visible children");
  // Whatever sits to the right of src moved right by the extra span.
  const after = (list: typeof collapsed, key: string) => list.find((n) => n.key === key)!.col;
  const rightNeighbour = collapsed.filter((n) => n.col > after(collapsed, "src")).sort((a, b) => a.col - b.col)[0];
  assert.ok(after(expanded, rightNeighbour.key) > after(collapsed, rightNeighbour.key));
});

test("projection and bounds are finite and back rows draw first", () => {
  const nodes = layoutIso(tree(), new Set(["src", "src/app"]));
  for (const n of nodes) { const p = project(n); assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y)); }
  const b = bounds(nodes);
  assert.ok(b.maxX >= b.minX && b.maxY >= b.minY);
  for (let i = 1; i < nodes.length; i++) assert.ok(nodes[i - 1].row >= nodes[i].row, "sorted back-to-front");
});

test("highlight helpers open the right folders", () => {
  assert.deepEqual(Array.from(ancestorsOf(["src/app/page.tsx"])).sort(), ["src", "src/app"]);
  assert.ok(isHighlighted("src/app/page.tsx", ["src/app"]));
  assert.ok(!isHighlighted("src/apple.ts", ["src/app"]), "prefix must be a whole path segment");
});

function structure(): RepoStructure {
  return {
    fullName: "acme/app", defaultBranch: "main", tree: tree(), totalFiles: 11, truncated: false,
    readme: "", manifests: {}, stack: ["Next.js", "TypeScript"], dirs: [], accessible: true,
  };
}

test("heuristic architecture groups folders into plain-language modules", () => {
  const { architecture, connections, stackSummary } = heuristicArchitecture(structure());
  const byName = Object.fromEntries(architecture.map((m) => [m.name, m]));
  assert.equal(byName["app"]?.category, "frontend");
  assert.equal(byName["app"]?.layer, 0);
  assert.equal(byName["tests"]?.category, "tests");
  assert.equal(byName["docs"]?.category, "docs");
  assert.ok(connections.every((c) => architecture.some((m) => m.id === c.from) && architecture.some((m) => m.id === c.to)));
  assert.match(stackSummary, /Next\.js, TypeScript/);
});

test("heuristic location follows mentioned paths, else the entry point", () => {
  const { architecture } = heuristicArchitecture(structure());
  const hit = heuristicLocation(architecture, ["src/lib/db.ts"]);
  assert.ok(hit.moduleIds.some((id) => id.includes("lib")));
  assert.equal(hit.source, "heuristic");
  const none = heuristicLocation(architecture, []);
  const entry = architecture.find((m) => m.id === none.moduleIds[0])!;
  assert.equal(entry.layer, 0);
});
