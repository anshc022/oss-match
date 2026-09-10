/** Shapes shared by the Deep Dive generator, API and renderers. */

export type TreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: TreeNode[];
  /** Files beneath this node, counted before pruning. */
  fileCount: number;
};

export const MODULE_CATEGORIES = ["frontend", "backend", "config", "tests", "docs"] as const;
export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export type ArchModule = {
  id: string;
  name: string;
  description: string;
  filePaths: string[];
  category: ModuleCategory;
  /** 0 = entry / UI, 1 = logic, 2 = data. */
  layer: 0 | 1 | 2;
};

export type Connection = { from: string; to: string; label: string };

export type IssueLocation = {
  moduleIds: string[];
  reasoning: string;
  /** Paths the issue text itself mentioned that exist in the tree. */
  mentionedPaths: string[];
  source: "ai" | "heuristic";
};

export type DeepDive = {
  architecture: ArchModule[];
  connections: Connection[];
  stackSummary: string;
  stack: string[];
  fileTree: TreeNode;
  /** True when the repo was too large and the tree was cut at two levels. */
  truncated: boolean;
  totalFiles: number;
  source: "ai" | "heuristic";
  generatedAt: string;
};

export type DeepDiveStage = "idle" | "tree" | "analyzing" | "mapping" | "ready" | "error" | "unavailable";

export const STAGE_COPY: Record<DeepDiveStage, string> = {
  idle: "Preparing…",
  tree: "Reading file tree…",
  analyzing: "Analyzing architecture…",
  mapping: "Mapping your issue…",
  ready: "Ready",
  error: "Could not analyse this repo",
  unavailable: "Repo not accessible",
};
