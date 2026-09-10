"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { ArchModule, Connection } from "@/lib/deepdive/types";

/**
 * Modules as nodes in a real 3D scene, stacked by layer: entry points on top,
 * data at the bottom. Hover lights a node and its edges; click flies the
 * camera to it. Loaded lazily so three.js only ships when this tab opens.
 */

export type GraphProps = {
  modules: ArchModule[];
  connections: Connection[];
  highlightIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  reduced: boolean;
};

const MAX_NODES = 22;

const CATEGORY_COLOR: Record<string, string> = {
  frontend: "#9b7bff",
  backend: "#22d3ee",
  config: "#f5a623",
  tests: "#f4699a",
  docs: "#8a8aa3",
  other: "#6b6b80",
};

type Placed = { m: ArchModule; pos: THREE.Vector3; color: string };

/** Cap the scene and fold overflow into one node. */
export function placeNodes(modules: ArchModule[], highlightIds: string[]): Placed[] {
  let list = modules;
  if (modules.length > MAX_NODES) {
    const keep = [...modules].sort((a, b) => Number(highlightIds.includes(b.id)) - Number(highlightIds.includes(a.id)) || b.filePaths.length - a.filePaths.length).slice(0, MAX_NODES - 1);
    const rest = modules.filter((m) => !keep.includes(m));
    list = [...keep, { id: "other", name: `${rest.length} other modules`, description: rest.map((r) => r.name).join(", "), filePaths: [], category: "config", layer: 1 }];
  }
  const byLayer = [0, 1, 2].map((l) => list.filter((m) => m.layer === l));
  const out: Placed[] = [];
  byLayer.forEach((group, layer) => {
    const y = (1 - layer) * 2.4;
    const r = group.length <= 1 ? 0 : 1.6 + group.length * 0.35;
    group.forEach((m, i) => {
      const a = (i / group.length) * Math.PI * 2 + layer * 0.6;
      out.push({ m, pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), color: CATEGORY_COLOR[m.id === "other" ? "other" : m.category] ?? CATEGORY_COLOR.other });
    });
  });
  return out;
}

export default function ArchGraph(props: GraphProps) {
  return (
    <div className="relative h-[440px] w-full overflow-hidden rounded-xl border border-border/70 bg-card/60 sm:h-[520px]">
      <Canvas dpr={[1, 1.75]} camera={{ position: [7, 5, 9], fov: 45 }} gl={{ antialias: true, powerPreference: "low-power" }}>
        <color attach="background" args={["#0b0912"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 10, 4]} intensity={1.1} />
        <pointLight position={[-6, -4, -6]} intensity={0.4} color="#9b7bff" />
        <Scene {...props} />
      </Canvas>
      <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] text-muted-foreground">
        drag to rotate · scroll to zoom · click a module
      </p>
    </div>
  );
}

function Scene({ modules, connections, highlightIds, selectedId, onSelect, reduced }: GraphProps) {
  const placed = useMemo(() => placeNodes(modules, highlightIds), [modules, highlightIds]);
  const byId = useMemo(() => new Map(placed.map((p) => [p.m.id, p])), [placed]);
  const edges = useMemo(
    () => connections.map((c) => ({ ...c, a: byId.get(c.from), b: byId.get(c.to) })).filter((e) => e.a && e.b) as Array<Connection & { a: Placed; b: Placed }>,
    [connections, byId],
  );
  const [hover, setHover] = useState<string | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const idle = useRef(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const { camera } = useThree();
  const target = useRef<THREE.Vector3 | null>(null);

  // Fly to the selected node; OrbitControls' target follows so rotation stays centred on it.
  useEffect(() => {
    const p = selectedId ? byId.get(selectedId) : null;
    target.current = p ? p.pos.clone() : null;
  }, [selectedId, byId]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (target.current) {
      const t = target.current;
      c.target.lerp(t, Math.min(1, dt * 4));
      const desired = t.clone().add(new THREE.Vector3(3.5, 2.2, 4.5));
      camera.position.lerp(desired, Math.min(1, dt * 3));
      if (camera.position.distanceTo(desired) < 0.05) target.current = null;
    }
    c.autoRotate = !reduced && idle.current && !hover && !selectedId;
    c.update();
  });

  function touched() {
    idle.current = false;
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => (idle.current = true), 4000);
  }

  const related = (id: string) => edges.some((e) => e.from === id || e.to === id);
  const edgeLit = (e: { from: string; to: string }) => !hover || e.from === hover || e.to === hover;

  return (
    <>
      <OrbitControls ref={controls} enablePan enableZoom autoRotateSpeed={0.6} onStart={touched} minDistance={4} maxDistance={24} />

      {/* Faint layer discs so the stacking reads. */}
      {[0, 1, 2].map((l) => (
        <mesh key={l} position={[0, (1 - l) * 2.4 - 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 5.2, 48]} />
          <meshBasicMaterial color="#9b7bff" transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {edges.map((e, i) => (
        <Edge key={`${e.from}-${e.to}-${i}`} a={e.a.pos} b={e.b.pos} lit={edgeLit(e)} dim={Boolean(hover) && !edgeLit(e)} animate={!reduced && edges.length <= 20} seed={i} />
      ))}

      {placed.map((p) => (
        <Node
          key={p.m.id}
          p={p}
          hovered={hover === p.m.id}
          dimmed={Boolean(hover) && hover !== p.m.id && !edges.some((e) => (e.from === hover && e.to === p.m.id) || (e.to === hover && e.from === p.m.id))}
          highlighted={highlightIds.includes(p.m.id)}
          selected={selectedId === p.m.id}
          reduced={reduced}
          hasEdges={related(p.m.id)}
          onHover={(h) => { setHover(h ? p.m.id : null); touched(); }}
          onClick={() => { onSelect(selectedId === p.m.id ? null : p.m.id); touched(); }}
        />
      ))}
    </>
  );
}

function Node({ p, hovered, dimmed, highlighted, selected, reduced, onHover, onClick }: {
  p: Placed; hovered: boolean; dimmed: boolean; highlighted: boolean; selected: boolean; reduced: boolean; hasEdges: boolean;
  onHover: (h: boolean) => void; onClick: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const t = useRef(Math.random() * 10);

  useFrame((_, dt) => {
    t.current += dt;
    const s = hovered || selected ? 1.28 : 1;
    if (mesh.current) mesh.current.scale.lerp(new THREE.Vector3(s, s, s), reduced ? 1 : Math.min(1, dt * 10));
    if (mat.current) {
      const e = hovered || selected ? 0.9 : highlighted ? 0.45 + (reduced ? 0 : Math.sin(t.current * 2) * 0.2) : 0.12;
      mat.current.emissiveIntensity += (e - mat.current.emissiveIntensity) * Math.min(1, dt * 8);
      mat.current.opacity += ((dimmed ? 0.25 : 1) - mat.current.opacity) * Math.min(1, dt * 8);
    }
    if (ring.current && highlighted) {
      const k = reduced ? 1.4 : 1.2 + ((t.current * 0.6) % 1) * 0.8;
      ring.current.scale.set(k, k, k);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = reduced ? 0.35 : 0.6 * (1 - ((t.current * 0.6) % 1));
    }
  });

  const isEntry = p.m.layer === 0;
  return (
    <group position={p.pos}>
      <mesh
        ref={mesh}
        onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(false); document.body.style.cursor = ""; }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        {isEntry ? <sphereGeometry args={[0.42, 24, 24]} /> : <boxGeometry args={[0.8, 0.5, 0.8]} />}
        <meshStandardMaterial ref={mat} color={p.color} emissive={p.color} emissiveIntensity={0.12} roughness={0.4} metalness={0.15} transparent opacity={1} />
      </mesh>
      {highlighted && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.62, 40]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Html center distanceFactor={9} position={[0, isEntry ? 0.7 : 0.55, 0]} style={{ pointerEvents: "none", opacity: dimmed ? 0.35 : 1, transition: "opacity 150ms" }}>
        <div
          className={`whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[11px] ${highlighted ? "border-neon/60 bg-neon/15 text-neon" : "border-border/70 bg-background/85 text-foreground"}`}
        >
          {p.m.name}
        </div>
      </Html>
    </group>
  );
}

function Edge({ a, b, lit, dim, animate, seed }: { a: THREE.Vector3; b: THREE.Vector3; lit: boolean; dim: boolean; animate: boolean; seed: number }) {
  const dot = useRef<THREE.Mesh>(null);
  const t = useRef((seed * 0.37) % 1);
  useFrame((_, dt) => {
    if (!animate || !dot.current) return;
    t.current = (t.current + dt / 5.5) % 1; // one trip every ~5.5s
    dot.current.position.lerpVectors(a, b, t.current);
  });
  return (
    <>
      <Line points={[a, b]} color={lit ? "#9b7bff" : "#3a3550"} lineWidth={lit && !dim ? 1.6 : 0.8} transparent opacity={dim ? 0.15 : lit ? 0.85 : 0.45} />
      {animate && !dim && (
        <mesh ref={dot}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      )}
    </>
  );
}
