// ConstructionLayer — the geometric annotations of a mathematics textbook:
// radius / diameter / height / slant-height lines, the centre O, angle arcs,
// right-angle squares, equal-length ticks, parallel chevrons and midpoints.
//
// Everything is real geometry in the solid's local frame, so it rotates with the
// object and is recomputed the moment a dimension changes.

import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { Label3D } from "./Label3D";
import {
  arcFromPoints, arcLabelPosition, arcPoints, centreOf, constructionSegment, markSegments, midOf,
  rightAngleSquare, type ConstructionKind, type LabelSettings, type MarkKind,
} from "@/lib/geometry3d/labeling";
import { topologyFor } from "@/lib/geometry3d/topology";
import { formatMeasure } from "@/lib/geometry3d/units";
import type { Annotation3D, Solid3D, Vec3 } from "@/lib/geometry3d/scene3d";

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Small V arrowhead at the end of a dimension line. */
function Arrow({ at, dir, color }: { at: Vec3; dir: Vec3; color: string }) {
  const d = unit(dir);
  const side = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const back = add(at, mul(d, -0.14));
  const p1 = add(back, mul(side, 0.055));
  const p2 = add(back, mul(side, -0.055));
  return (
    <>
      <Line points={[at, p1]} color={color} lineWidth={2} raycast={() => null} />
      <Line points={[at, p2]} color={color} lineWidth={2} raycast={() => null} />
    </>
  );
}

/** ∠ABC drawn as a true arc in the plane of the two rays. */
export function AngleArc3D({
  a, b, c, light, color = "#f472b6", size = 0.45, caption,
}: { a: Vec3; b: Vec3; c: Vec3; light: boolean; color?: string; size?: number; caption?: string }) {
  const spec = useMemo(() => arcFromPoints(a, b, c, size), [a, b, c, size]);
  if (!spec) return null;
  const right = Math.abs(spec.degrees - 90) < 0.6;
  const pts = right ? rightAngleSquare(spec) : arcPoints(spec);
  if (pts.length < 2) return null;
  const labelPos = arcLabelPosition(spec);
  const text = caption ?? (right ? "90\u00B0" : `${spec.degrees.toFixed(1)}\u00B0`);
  return (
    <group>
      <Line points={pts} color={color} lineWidth={2} raycast={() => null} />
      <Label3D
        text={text}
        position={labelPos}
        offsetDir={unit(sub(labelPos, spec.vertex))}
        offset={0.16}
        accent={color}
        light={light}
        size={0.15}
      />
    </group>
  );
}

/** Textbook marks on an edge: equal ticks, parallel chevrons, midpoint dot. */
function EdgeMark({
  solid, index, mark, count, color, light,
}: { solid: Solid3D; index: number; mark: MarkKind; count: number; color: string; light: boolean }) {
  const topo = useMemo(() => topologyFor(solid), [solid]);
  const edge = topo.edges[index];
  if (!edge || edge.shape !== "straight") return null;
  if (mark === "rightAngle") {
    // right-angle square between this edge and the next edge sharing a vertex
    const other = topo.edges.find(
      (e) => e.index !== index && e.shape === "straight" &&
        (["a", "b"] as const).some((k) => (["a", "b"] as const).some((k2) =>
          Math.hypot(...(sub(e[k] as Vec3, edge[k2] as Vec3))) < 1e-6)),
    );
    if (!other || other.shape !== "straight") return null;
    const shared = ([edge.a, edge.b] as Vec3[]).find((p) =>
      ([other.a, other.b] as Vec3[]).some((q) => Math.hypot(...sub(p, q)) < 1e-6));
    if (!shared) return null;
    const far1 = Math.hypot(...sub(edge.a, shared)) < 1e-6 ? edge.b : edge.a;
    const far2 = Math.hypot(...sub(other.a, shared)) < 1e-6 ? other.b : other.a;
    return <AngleArc3D a={far1} b={shared} c={far2} light={light} color={color} size={0.3} />;
  }
  const { ticks, dot } = markSegments(edge, mark, count);
  return (
    <group>
      {ticks.map((t, i) => (
        <Line key={i} points={[t[0], t[1]]} color={color} lineWidth={2.5} raycast={() => null} />
      ))}
      {dot && (
        <mesh position={dot} raycast={() => null}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );
}

interface Props {
  solid: Solid3D;
  settings: LabelSettings;
  annotations: Annotation3D[];
  light: boolean;
  unit: string;
  decimals: number;
  /** Maths units per rendered unit — see displayScale.ts. */
  mathScale?: number;
}

export function ConstructionLayer({ solid, settings, annotations, light, unit: u, decimals, mathScale = 1 }: Props) {

  const fmt = (n: number) => formatMeasure(n * mathScale, u, decimals, 1);

  // Only annotations the teacher has switched on reach this layer; each one is
  // an independent construction item with its own styling.
  const constructions = annotations.filter((a) => a.type === "construction");
  const items = useMemo(
    () => constructions.flatMap((a) => {
      const kind = (a.data?.kind as ConstructionKind) ?? "radius";
      const seg = constructionSegment(solid, kind, fmt);
      return seg ? [{ a, seg }] : [];
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solid, constructions.map((a) => `${a.id}:${a.data?.kind}`).join("|"), u, decimals, mathScale],
  );

  const centre = useMemo(() => centreOf(solid), [solid]);
  const showCentre = items.some(({ a }) =>
    a.data?.kind === "radius" || a.data?.kind === "diameter"
  ) && settings.construction;

  const marks = annotations.filter((a) => a.type === "mark" && a.target.kind === "edge" && a.target.index != null);
  const hidden = annotations.filter((a) => a.type === "hiddenEdge" && a.target.kind === "edge" && a.target.index != null);
  const topo = useMemo(() => topologyFor(solid), [solid]);

  const showConstruction = settings.construction;

  return (
    <group>
      {showCentre && centre && (
        <group>
          <mesh position={centre} raycast={() => null}>
            <sphereGeometry args={[0.07, 14, 10]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <Label3D
            text="O"
            position={centre}
            offsetDir={[0, -1, 0]}
            offset={0.24}
            accent="#38bdf8"
            light={light}
            size={0.15}
            noLayout
          />
        </group>
      )}

      {showConstruction && items.map(({ a, seg: s }) => {
        const st = a.style ?? {};
        const color = st.lineColor ?? a.color ?? s.color;
        const width = st.lineWidth ?? 2.5;
        const op = st.opacity ?? 1;
        const text = st.labelText ?? a.text ?? s.text;
        const dir = unit(sub(s.b, s.a));
        const perp = unit(cross(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
        return (
          <group key={a.id}>
            <Line
              points={[s.a, s.b]}
              color={color}
              lineWidth={width}
              transparent={op < 1}
              opacity={op}
              dashed={!!s.dashed}
              dashSize={0.12}
              gapSize={0.08}
              raycast={() => null}
            />
            {s.arrows && (
              <>
                <Arrow at={s.b} dir={dir} color={color} />
                <Arrow at={s.a} dir={mul(dir, -1)} color={color} />
              </>
            )}
            {/* endpoint A of the radius, so "OA" means something on the diagram */}
            {s.id === "radius" && (
              <mesh position={s.b} raycast={() => null}>
                <sphereGeometry args={[0.06, 12, 10]} />
                <meshBasicMaterial color={color} />
              </mesh>
            )}
            {text && (
              <Label3D
                text={text}
                position={midOf(s.a, s.b)}
                offsetDir={perp}
                offset={0.2}
                alignDir={dir}
                accent={color}
                light={light}
                size={st.labelSize ?? 0.15}
                noLayout
              />
            )}
          </group>
        );
      })}


      {/* Hidden edges drawn dashed, as in an examination diagram */}
      {hidden.map((a) => {
        const e = topo.edges[a.target.index!];
        if (!e || e.shape !== "straight") return null;
        return (
          <Line
            key={a.id}
            points={[e.a, e.b]}
            color={a.color ?? "#94a3b8"}
            lineWidth={1.6}
            dashed
            dashSize={0.12}
            gapSize={0.09}
            raycast={() => null}
          />
        );
      })}

      {marks.map((a) => (
        <EdgeMark
          key={a.id}
          solid={solid}
          index={a.target.index!}
          mark={((a.data?.mark as MarkKind) ?? "equal")}
          count={Number(a.data?.count ?? 1)}
          color={a.color ?? "#f59e0b"}
          light={light}
        />
      ))}
    </group>
  );
}

export default ConstructionLayer;
