/**
 * Voxel figures drawn as flat SVG.
 *
 * A figure is a list of unit cubes on an integer grid. Each is projected to
 * true isometric and drawn as up to three faces, lit from the top-left so the
 * top is brightest and the two visible sides step down. That is enough to read
 * as a rendered 3D object without shipping a renderer: a whole character is a
 * few hundred polygons that the browser rasterises once.
 *
 * Axes: +x runs toward the viewer's lower-right, +y toward the lower-left,
 * +z straight up. A figure "faces" +x, so its face and eyes sit on the +x side.
 *
 * Pure: no DOM, no React, so it is testable with tsx directly.
 */

export type Voxel = { x: number; y: number; z: number; color: string };

export type Face = {
  /** Which side of the cube this is. */
  side: "top" | "right" | "left";
  /** Screen-space polygon, four points. */
  points: Array<[number, number]>;
  fill: string;
  /** Painter's-order key; higher draws later, on top. */
  depth: number;
};

/** A solid block of one colour. `w` runs along x, `d` along y, `h` along z. */
export function box(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
): Voxel[] {
  const out: Voxel[] = [];
  for (let i = 0; i < w; i++)
    for (let j = 0; j < d; j++)
      for (let k = 0; k < h; k++) out.push({ x: x + i, y: y + j, z: z + k, color });
  return out;
}

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * Later entries win, so a figure can be built by stacking a base shape and
 * then painting details (eyes, a fringe, a logo) over it.
 */
export function merge(...layers: Voxel[][]): Voxel[] {
  const map = new Map<string, Voxel>();
  for (const layer of layers) for (const v of layer) map.set(key(v.x, v.y, v.z), v);
  return Array.from(map.values());
}

/** Screen position of a lattice corner, in units. */
export function project(x: number, y: number, z: number): [number, number] {
  // cos 30° and sin 30°: the classic 2:1 isometric diamond.
  return [(x - y) * 0.8660254, (x + y) * 0.5 - z];
}

/**
 * Faces to draw, culled and sorted. A face is skipped when the neighbouring
 * cube on that side exists, since it could never be seen. What remains is
 * ordered by x+y+z, which is a correct painter's order for unit cubes in this
 * projection: anything further along x or y, or higher, is nearer the viewer.
 */
export function facesOf(voxels: Voxel[]): Face[] {
  const solid = new Set(voxels.map((v) => key(v.x, v.y, v.z)));
  const faces: Face[] = [];

  for (const { x, y, z, color } of voxels) {
    const depth = x + y + z;
    if (!solid.has(key(x, y, z + 1))) {
      faces.push({
        side: "top",
        depth,
        fill: shade(color, "top"),
        points: [project(x, y, z + 1), project(x + 1, y, z + 1), project(x + 1, y + 1, z + 1), project(x, y + 1, z + 1)],
      });
    }
    if (!solid.has(key(x + 1, y, z))) {
      faces.push({
        side: "right",
        depth,
        fill: shade(color, "right"),
        points: [project(x + 1, y, z), project(x + 1, y + 1, z), project(x + 1, y + 1, z + 1), project(x + 1, y, z + 1)],
      });
    }
    if (!solid.has(key(x, y + 1, z))) {
      faces.push({
        side: "left",
        depth,
        fill: shade(color, "left"),
        points: [project(x, y + 1, z), project(x + 1, y + 1, z), project(x + 1, y + 1, z + 1), project(x, y + 1, z + 1)],
      });
    }
  }

  // Stable sort keeps the top/right/left order within one cube, which only
  // matters at the cube's own edges and keeps those edges crisp.
  return faces.sort((a, b) => a.depth - b.depth);
}

/** Screen-space bounds of a figure, in units, so a viewBox can wrap it. */
export function bounds(voxels: Voxel[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { x, y, z } of voxels) {
    for (const [px, py] of [
      project(x, y, z), project(x + 1, y, z), project(x, y + 1, z), project(x + 1, y + 1, z),
      project(x, y, z + 1), project(x + 1, y, z + 1), project(x, y + 1, z + 1), project(x + 1, y + 1, z + 1),
    ]) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/* ------------------------------------------------------------- lighting */

const LIGHT: Record<Face["side"], number> = { top: 0.14, right: -0.08, left: -0.2 };

/** Lighten or darken a hex colour by moving its HSL lightness. */
export function shade(hex: string, side: Face["side"]): string {
  const [h, s, l] = hexToHsl(hex);
  const nl = Math.min(1, Math.max(0, l + LIGHT[side]));
  return hslToHex(h, s, nl);
}

export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
