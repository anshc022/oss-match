import { bounds, facesOf, type Voxel } from "@/lib/voxel";
import { figure, type FigureOptions } from "@/components/landing/story/characters";
import { cn } from "@/lib/utils";

/**
 * Draws a voxel figure as inline SVG. A server component: the voxel data and
 * the face maths stay on the server, and the client receives only polygons.
 *
 * `unit` is the pixel size of one cube. Everything else is derived from the
 * figure's own bounds, so a figure can be dropped anywhere at any size.
 */
export function VoxelFigure({
  voxels,
  unit = 8,
  shadow = true,
  className,
  title,
}: {
  voxels: Voxel[];
  unit?: number;
  shadow?: boolean;
  className?: string;
  /** Accessible name. Omit for a purely decorative figure. */
  title?: string;
}) {
  const faces = facesOf(voxels);
  const b = bounds(voxels);
  const pad = 1.2;
  const width = (b.width + pad * 2) * unit;
  const height = (b.height + pad * 2) * unit;

  return (
    <svg
      viewBox={`${(b.minX - pad) * unit} ${(b.minY - pad) * unit} ${width} ${height}`}
      width={width}
      height={height}
      className={cn("block max-w-full", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {shadow && (
        <ellipse
          cx={((b.minX + b.maxX) / 2) * unit}
          cy={(b.maxY - 0.15) * unit}
          rx={(b.width / 2) * unit * 0.85}
          ry={unit * 1.1}
          fill="#000"
          opacity={0.13}
        />
      )}
      {faces.map((f, i) => (
        <polygon
          key={i}
          points={f.points.map(([x, y]) => `${(x * unit).toFixed(2)},${(y * unit).toFixed(2)}`).join(" ")}
          fill={f.fill}
          // A hairline stroke in the fill colour closes the antialiasing seams
          // between faces, which otherwise show as a faint grid.
          stroke={f.fill}
          strokeWidth={0.6}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/** Convenience: a character by role, so call sites do not touch voxel data. */
export function Character({
  unit,
  shadow,
  className,
  title,
  ...opts
}: FigureOptions & { unit?: number; shadow?: boolean; className?: string; title?: string }) {
  return <VoxelFigure voxels={figure(opts)} unit={unit} shadow={shadow} className={className} title={title} />;
}
