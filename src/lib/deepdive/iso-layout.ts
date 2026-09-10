import type { TreeNode } from "@/lib/deepdive/types";

/**
 * Pure layout for the isometric file tree: grid coordinates, not pixels, so
 * the renderer can project and animate them. Top-level entries run along the
 * x axis; an expanded folder's children sit one row back and one level up, so
 * nesting reads as physical height and siblings shift to make room.
 */

export type IsoNode = {
  key: string;
  node: TreeNode;
  col: number;
  row: number;
  depth: number;
  /** Columns this node's visible subtree occupies. */
  span: number;
  isDir: boolean;
  hasChildren: boolean;
  expanded: boolean;
};

export function layoutIso(root: TreeNode, expanded: Set<string>): IsoNode[] {
  const out: IsoNode[] = [];

  function place(node: TreeNode, col: number, row: number, depth: number): number {
    const isDir = node.type === "dir";
    const kids = node.children ?? [];
    const isExpanded = isDir && expanded.has(node.path) && kids.length > 0;

    let span = 1;
    if (isExpanded) {
      let c = col;
      for (const child of kids) c += place(child, c, row + 1, depth + 1);
      span = Math.max(1, c - col);
    }
    out.push({ key: node.path || "/", node, col, row, depth, span, isDir, hasChildren: kids.length > 0, expanded: isExpanded });
    return span;
  }

  // Root entries wrap into rows of ROOT_WRAP. Rows are spaced ROW_GAP apart
  // so an opened folder's children (one row back) have room before the next
  // band of root entries; deeper nesting is bounded by the tree's depth cut.
  const kids = root.children ?? [];
  let c = 0;
  let band = 0;
  kids.forEach((child, i) => {
    if (i > 0 && i % ROOT_WRAP === 0) { band += 1; c = 0; }
    c += place(child, c, band * ROW_GAP, 0);
  });
  // Parents were pushed after their children (post-order); draw order wants
  // back rows first so fronts overlap backs. Sort by (row desc, depth asc, col).
  return out.sort((a, b) => b.row - a.row || a.depth - b.depth || a.col - b.col);
}

/** Root entries per band before wrapping. */
export const ROOT_WRAP = 8;
/** Rows between root bands, leaving space for opened folders. */
export const ROW_GAP = 3;

export const TILE_W = 64;
export const TILE_H = 32;
export const LIFT = 16;

/** Grid → screen. The parent's span centres it over its expanded children. */
export function project(n: IsoNode) {
  const cx = n.col + (n.span - 1) / 2;
  return {
    x: (cx - n.row) * (TILE_W / 2),
    y: (cx + n.row) * (TILE_H / 2) - n.depth * LIFT,
  };
}

export function bounds(nodes: IsoNode[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const { x, y } = project(n);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!isFinite(minX)) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return { minX, maxX, minY, maxY };
}

/** Folders that contain any highlighted path, so they start expanded. */
export function ancestorsOf(paths: string[]): Set<string> {
  const set = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join("/"));
  }
  return set;
}

/**
 * A node is on the issue's path when it is a highlighted path, sits inside
 * one, or contains one. The last case matters because a large repo's tree is
 * cut to two levels, so the folder that actually holds the change is often
 * only present as an ancestor.
 */
export function isHighlighted(path: string, highlights: string[]) {
  return highlights.some((h) => {
    if (!h) return false;
    const clean = h.replace(/\/$/, "");
    return path === clean || path.startsWith(clean + "/") || clean.startsWith(path + "/");
  });
}
