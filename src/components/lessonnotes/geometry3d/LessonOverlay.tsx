// LessonOverlay — the visual layer for the eight advanced Lesson Modes.
// Reads scene.annotations and renders measurements, shades, angles, points,
// segments, slicing planes, and transformation ghosts.

import { useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { geometryFor, baseRotationY } from "@/lib/geometry3d/geometryFactory";
import { topologyFor, labelAnchor, type EdgeEl, type FaceEl } from "@/lib/geometry3d/topology";
import {
  edgeLength, faceArea, edgeEdgeAngle, faceFaceAngle, edgeFaceAngle,
  distance, formatNumber,
} from "@/lib/geometry3d/measure";
import { transformMatrix, type TransformSpec } from "@/lib/geometry3d/transforms";
import { visibleAnnotations } from "@/lib/geometry3d/scene3d";
import type { Annotation3D, Scene3D, Solid3D, Vec3 } from "@/lib/geometry3d/scene3d";

import { unitSuffix } from "@/lib/geometry3d/units";
import { Label3D } from "./labels/Label3D";
import { bodyCenter, frameFor } from "@/lib/geometry3d/labeling";

function labelClass(light: boolean, extra = "") {
  return `select-none whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold shadow-sm ${extra} ${
    light ? "bg-white/90 text-slate-800" : "bg-slate-900/85 text-white"
  }`;
}

function SolidOverlayGroup({ solid, children }: { solid: Solid3D; children: React.ReactNode }) {
  return (
    <group position={solid.position} rotation={solid.rotation} scale={solid.scale}>
      <group rotation={[0, baseRotationY(solid), 0]}>{children}</group>
    </group>
  );
}

interface Props {
  scene: Scene3D;
  light: boolean;
  unit?: string;
  decimals?: number;
  /** Dimension guide to emphasise (hovering a dimension row in the panel). */
  emphasis?: { solidId: string; guide: string } | null;
  /** Face to glow (hovering a net face or a face row). */
  highlightFace?: { solidId: string; index: number } | null;
  /** Solid to fill translucently (Volume mode). */
  fillSolidId?: string | null;
  /** Maths units per rendered unit for a solid — see displayScale.ts. */
  scaleOf?: (solidId: string) => number;
}

export function LessonOverlay({
  scene, light, unit = "none", decimals = 2,
  emphasis = null, highlightFace = null, fillSolidId = null, scaleOf,
}: Props) {
  const k = (id: string) => scaleOf?.(id) ?? 1;
  // Display engine: only what the teacher has switched on is drawn.
  const annotations = visibleAnnotations(scene.annotations);
  const solidsById = useMemo(
    () => Object.fromEntries(scene.objects.map((s) => [s.id, s])) as Record<string, Solid3D>,
    [scene.objects],
  );

  const suffix = unitSuffix(unit, 1);
  const fmt = (n: number) => `${formatNumber(n, decimals)}${suffix}`;

  // -------- measurements & shades per solid --------
  const solidAnnots = useMemo(() => {
    const map = new Map<string, Annotation3D[]>();
    for (const a of annotations) {
      if (!solidsById[a.target.solidId]) continue;
      const list = map.get(a.target.solidId) ?? [];
      list.push(a);
      map.set(a.target.solidId, list);
    }
    return map;
  }, [annotations, solidsById]);

  const worldAnnots = annotations.filter((a) => a.target.solidId.startsWith("__"));
  const points = worldAnnots.filter((a) => a.type === "point" && Array.isArray(a.position));
  const segments = worldAnnots.filter((a) => a.type === "segment" && Array.isArray(a.data?.indices));

  return (
    <group>
      {/* Per-solid overlays */}
      {scene.objects.map((solid) => {
        const topo = topologyFor(solid);
        const list = solidAnnots.get(solid.id) ?? [];
        return (
          <SolidOverlayGroup key={solid.id} solid={solid}>
            {/* Translucent volume fill */}
            {fillSolidId === solid.id && <VolumeFill solid={solid} />}

            {/* Hover-linked face glow */}
            {highlightFace?.solidId === solid.id && topo.faces[highlightFace.index] && (
              <FaceShaded face={topo.faces[highlightFace.index]} solid={solid} color="#ffffff" />
            )}

            {/* Dimension guide */}
            {emphasis?.solidId === solid.id && (
              <DimensionGuide solid={solid} guide={emphasis.guide} light={light} unit={unit} decimals={decimals} mathScale={k(solid.id)} />
            )}

            {/* Shades */}
            {list.filter((a) => a.type === "shade" && a.target.kind === "face" && a.target.index != null)
              .map((a) => {
                const f = topo.faces[a.target.index!];
                if (!f) return null;
                return <FaceShaded key={a.id} face={f} solid={solid} color={a.color ?? "#38bdf8"} />;
              })}

            {/* Measurements */}
            {list.filter((a) => a.type === "measurement").map((a) => {
              const st = a.style ?? {};
              if (a.target.kind === "edge" && a.target.index != null) {
                const e = topo.edges[a.target.index]; if (!e) return null;
                // Welded to the edge: parallel to it, offset perpendicular, so it
                // rotates with the solid instead of floating in screen space.
                const frame = frameFor("edge", e, bodyCenter(solid));
                return (
                  <Label3D
                    key={a.id}
                    text={st.labelText ?? fmt(edgeLength(solid, e) * k(solid.id))}
                    position={frame.anchor}
                    offsetDir={frame.offsetDir}
                    offset={0.22}
                    alignDir={frame.alignDir ?? null}
                    accent={st.lineColor ?? a.color ?? "#f59e0b"}
                    light={light}
                    size={st.labelSize ?? 0.155}
                    noLayout
                  />
                );
              }
              if (a.target.kind === "face" && a.target.index != null) {
                const f = topo.faces[a.target.index]; if (!f) return null;
                const frame = frameFor("face", f, bodyCenter(solid));
                return (
                  <Label3D
                    key={a.id}
                    text={st.labelText ?? `A = ${fmt(faceArea(solid, f) * k(solid.id) ** 2)}\u00b2`}
                    position={frame.anchor}
                    offsetDir={frame.offsetDir}
                    offset={0.16}
                    accent={st.lineColor ?? a.color ?? "#34d399"}
                    light={light}
                    size={st.labelSize ?? 0.155}
                    noLayout
                  />
                );
              }
              return null;
            })}

            {/* Angles */}
            {list.filter((a) => a.type === "angle").map((a) => {
              const inds = a.target.indices ?? [];
              if (a.target.kind === "edgePair" && inds.length === 2) {
                const [i, j] = inds; const ea = topo.edges[i]; const eb = topo.edges[j];
                if (!ea || !eb) return null;
                const ang = edgeEdgeAngle(solid, ea, eb);
                if (ang == null) return null;
                const pos = midpointOfEdges(ea, eb);
                return <AngleMarker key={a.id} position={pos} degrees={ang} light={light} />;
              }
              if (a.target.kind === "facePair" && inds.length === 2) {
                const [i, j] = inds; const fa = topo.faces[i]; const fb = topo.faces[j];
                if (!fa || !fb) return null;
                const ang = faceFaceAngle(solid, fa, fb);
                const pos: Vec3 = midpoint(fa.center, fb.center);
                return <AngleMarker key={a.id} position={pos} degrees={ang} light={light} />;
              }
              if (a.target.kind === "edgeFace" && inds.length === 2) {
                const [i, j] = inds; const e = topo.edges[i]; const f = topo.faces[j];
                if (!e || !f) return null;
                const ang = edgeFaceAngle(solid, e, f);
                if (ang == null) return null;
                const pos: Vec3 = midpoint(f.center, e.shape === "straight" ? e.center : [e.center[0], e.center[1], e.center[2]]);
                return <AngleMarker key={a.id} position={pos} degrees={ang} light={light} />;
              }
              return null;
            })}

            {/* Distance between two vertices */}
            {list.filter((a) => a.type === "segment" && a.target.kind === "vertexPair").map((a) => {
              const inds = a.target.indices ?? [];
              if (inds.length !== 2) return null;
              const va = topo.vertices[inds[0]]; const vb = topo.vertices[inds[1]];
              if (!va || !vb) return null;
              const mid: Vec3 = midpoint(va.position, vb.position);
              const d = distance(va.position, vb.position) * k(solid.id);
              return (
                <group key={a.id}>
                  <Line points={[va.position, vb.position]} color="#fbbf24" lineWidth={2} dashed dashSize={0.1} gapSize={0.05} raycast={() => null} />
                  <Html position={mid} center style={{ pointerEvents: "none" }} zIndexRange={[30, 0]}>
                    <span className={labelClass(light, "border border-amber-400/60")}>{fmt(d)}</span>
                  </Html>
                </group>
              );
            })}
          </SolidOverlayGroup>
        );
      })}

      {/* Ghost previews (transformations) */}
      {annotations.filter((a) => a.type === "ghost").map((a) => {
        const target = solidsById[a.target.solidId];
        if (!target) return null;
        const spec = a.data as unknown as TransformSpec | undefined;
        if (!spec) return null;
        return <GhostSolid key={a.id} solid={target} spec={spec} />;
      })}

      {/* Slicing planes */}
      {annotations.filter((a) => a.type === "plane").map((a) => (
        <SlicingPlane key={a.id} axis={(a.data?.axis as "x" | "y" | "z") ?? "y"} offset={(a.data?.offset as number) ?? 0} light={light} />
      ))}

      {/* World points */}
      {points.map((a) => (
        <group key={a.id} position={a.position as Vec3}>
          <mesh>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshBasicMaterial color={a.color ?? "#fbbf24"} />
          </mesh>
          <Html center style={{ pointerEvents: "none" }} zIndexRange={[35, 0]}>
            <span className={labelClass(light, "border border-amber-400/70")}>
              {a.text ?? "P"} ({(a.position as Vec3).map((n) => formatNumber(n, decimals)).join(", ")})
            </span>
          </Html>
        </group>
      ))}

      {/* Segments joining two points */}
      {segments.map((a) => {
        const ids = (a.data?.indices as string[]) ?? [];
        const p1 = points.find((p) => p.id === ids[0]);
        const p2 = points.find((p) => p.id === ids[1]);
        if (!p1 || !p2) return null;
        const a1 = p1.position as Vec3, a2 = p2.position as Vec3;
        const d = distance(a1, a2);
        return (
          <group key={a.id}>
            <Line points={[a1, a2]} color={a.color ?? "#38bdf8"} lineWidth={2} raycast={() => null} />
            <Html position={midpoint(a1, a2)} center style={{ pointerEvents: "none" }} zIndexRange={[32, 0]}>
              <span className={labelClass(light, "border border-sky-400/70")}>{fmt(d)}</span>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function midpointOfEdges(a: EdgeEl, b: EdgeEl): Vec3 {
  const ca = a.shape === "straight" ? a.center : [a.center[0], a.center[1], a.center[2]] as Vec3;
  const cb = b.shape === "straight" ? b.center : [b.center[0], b.center[1], b.center[2]] as Vec3;
  return midpoint(ca, cb);
}

function FaceShaded({ face, solid, color }: { face: FaceEl; solid: Solid3D; color: string }) {
  const geometry = useMemo(() => {
    if (face.shape === "polygon" && face.points) {
      const g = new THREE.BufferGeometry();
      const p: number[] = [];
      for (let i = 1; i < face.points.length - 1; i++) {
        p.push(...face.points[0], ...face.points[i], ...face.points[i + 1]);
      }
      g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      g.computeVertexNormals();
      return g;
    }
    return geometryFor(solid);
  }, [face, solid]);
  const off: Vec3 = face.shape === "polygon"
    ? [face.normal[0] * 0.008, face.normal[1] * 0.008, face.normal[2] * 0.008]
    : [0, 0, 0];
  return (
    <mesh geometry={geometry} position={off} scale={face.shape === "curved" ? 1.008 : 1}>
      <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function VolumeFill({ solid }: { solid: Solid3D }) {
  const geo = useMemo(() => geometryFor(solid), [solid]);
  return (
    <mesh geometry={geo} raycast={() => null}>
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Arrow-style guide for one editable dimension of the solid. */
function DimensionGuide({
  solid, guide, light, unit, decimals, mathScale = 1,
}: { solid: Solid3D; guide: string; light: boolean; unit: string; decimals: number; mathScale?: number }) {
  const p = solid.params ?? {};
  const r = p.radius ?? (p.size ?? 2) / 2;
  const rTop = p.topRadius ?? 0;
  const h = p.height ?? p.size ?? 2;
  const size = p.size ?? 2;
  const w = p.width ?? size;
  const d = p.depth ?? size;
  const label = (text: string, pos: Vec3) => (
    <Html position={pos} center style={{ pointerEvents: "none" }} zIndexRange={[40, 0]}>
      <span className={labelClass(light, "border border-primary/70")}>{text}</span>
    </Html>
  );
  const fmt = (n: number) => `${formatNumber(n * mathScale, decimals)}${unitSuffix(unit, 1)}`;

  let a: Vec3 = [0, 0, 0];
  let b: Vec3 = [0, 0, 0];
  let text = "";
  switch (guide) {
    case "radiusX":
      a = [0, -h / 2, 0]; b = [r, -h / 2, 0]; text = `r = ${fmt(r)}`;
      break;
    case "topRadius":
      a = [0, h / 2, 0]; b = [rTop, h / 2, 0]; text = `r = ${fmt(rTop)}`;
      break;
    case "height":
      a = [r, -h / 2, 0]; b = [r, h / 2, 0]; text = `h = ${fmt(h)}`;
      break;
    case "width":
      a = [-w / 2, -(p.height ?? size) / 2, d / 2]; b = [w / 2, -(p.height ?? size) / 2, d / 2]; text = `l = ${fmt(w)}`;
      break;
    case "depth":
      a = [w / 2, -(p.height ?? size) / 2, -d / 2]; b = [w / 2, -(p.height ?? size) / 2, d / 2]; text = `w = ${fmt(d)}`;
      break;
    case "edge":
      a = [-size / 2, -size / 2, size / 2]; b = [size / 2, -size / 2, size / 2]; text = `a = ${fmt(size)}`;
      break;
    default:
      return null;
  }
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return (
    <group>
      <Line points={[a, b]} color="#f59e0b" lineWidth={3} raycast={() => null} />
      {label(text, mid)}
    </group>
  );
}

function AngleMarker({ position, degrees, light }: { position: Vec3; degrees: number; light: boolean }) {
  const rightAngle = Math.abs(degrees - 90) < 0.5;
  return (
    <Html position={position} center style={{ pointerEvents: "none" }} zIndexRange={[35, 0]}>
      <span className={labelClass(light, "border border-fuchsia-400/70")}>
        {rightAngle ? "▢ 90°" : `${degrees.toFixed(1)}°`}
      </span>
    </Html>
  );
}

function GhostSolid({ solid, spec }: { solid: Solid3D; spec: TransformSpec }) {
  const geo = useMemo(() => geometryFor(solid), [solid]);
  const matrix = useMemo(() => {
    const base = new THREE.Matrix4().compose(
      new THREE.Vector3(...solid.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...solid.rotation)),
      new THREE.Vector3(...solid.scale),
    );
    const t = transformMatrix(solid, spec);
    return t.multiply(base);
  }, [solid, spec]);
  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      <group rotation={[0, baseRotationY(solid), 0]}>
        <mesh geometry={geo} raycast={() => null}>
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <lineSegments raycast={() => null}>
          <primitive object={new THREE.EdgesGeometry(geo, 1)} attach="geometry" />
          <lineBasicMaterial color="#a78bfa" />
        </lineSegments>
      </group>
    </group>
  );
}

function SlicingPlane({ axis, offset, light }: { axis: "x" | "y" | "z"; offset: number; light: boolean }) {
  const rot: Vec3 = axis === "y" ? [-Math.PI / 2, 0, 0] : axis === "x" ? [0, 0, Math.PI / 2] : [0, 0, 0];
  const pos: Vec3 = axis === "y" ? [0, offset, 0] : axis === "x" ? [offset, 0, 0] : [0, 0, offset];
  return (
    <group position={pos} rotation={rot}>
      <mesh raycast={() => null}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial color={light ? "#0ea5e9" : "#38bdf8"} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments raycast={() => null}>
        <edgesGeometry args={[new THREE.PlaneGeometry(10, 10)]} />
        <lineBasicMaterial color="#38bdf8" />
      </lineSegments>
    </group>
  );
}

export default LessonOverlay;
