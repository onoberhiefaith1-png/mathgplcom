// The mathematical annotation layer for a solid: invisible pick proxies for
// faces / edges / vertices, plus the visible highlights and labels bound to
// them. Everything here lives in the solid's local geometry frame.

import { useMemo } from "react";
import * as THREE from "three";
import { geometryFor } from "@/lib/geometry3d/geometryFactory";
import {
  topologyFor,
  type EdgeEl, type ElementKind, type FaceEl, type Topology, type VertexEl,
} from "@/lib/geometry3d/topology";
import {
  DEFAULT_LABEL_SETTINGS, bodyCenter, edgeLabelText, frameFor,
  type LabelSettings,
} from "@/lib/geometry3d/labeling";
import { formatMeasure } from "@/lib/geometry3d/units";
import { Label3D } from "./labels/Label3D";
import { ConstructionLayer } from "./labels/ConstructionLayer";
import type { Annotation3D, Solid3D, Vec3 } from "@/lib/geometry3d/scene3d";

export const HIGHLIGHT_COLORS = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#f472b6", "#f87171"];
export const DEFAULT_HIGHLIGHT = HIGHLIGHT_COLORS[0];


/** Convex polygon → triangle-fan geometry. */
function polygonGeometry(points: Vec3[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    pos.push(...points[0], ...points[i], ...points[i + 1]);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function segmentTransform(a: Vec3, b: Vec3) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length() || 0.0001;
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  const e = new THREE.Euler().setFromQuaternion(q);
  return { position: [mid.x, mid.y, mid.z] as Vec3, rotation: [e.x, e.y, e.z] as Vec3, length: len };
}

function EdgeShape({ edge, radius, color, opacity }: { edge: EdgeEl; radius: number; color: string; opacity: number }) {
  if (edge.shape === "circle") {
    return (
      <mesh position={edge.center} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[edge.radius, radius, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
    );
  }
  const t = segmentTransform(edge.a, edge.b);
  return (
    <mesh position={t.position} rotation={t.rotation}>
      <cylinderGeometry args={[radius, radius, t.length, 8]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function FaceShape({
  face, solid, color, opacity, offset,
}: { face: FaceEl; solid: Solid3D; color: string; opacity: number; offset: number }) {
  const geometry = useMemo(
    () => (face.shape === "polygon" && face.points ? polygonGeometry(face.points) : geometryFor(solid)),
    [face, solid],
  );
  const pos: Vec3 =
    face.shape === "polygon"
      ? [face.normal[0] * offset, face.normal[1] * offset, face.normal[2] * offset]
      : [0, 0, 0];
  return (
    <mesh geometry={geometry} position={pos} scale={face.shape === "curved" ? 1.004 : 1}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

interface Props {
  solid: Solid3D;
  annotations: Annotation3D[];
  showLabels: boolean;
  /** Classroom label toggles. */
  labelSettings?: LabelSettings;
  /** Maths units per rendered unit — see displayScale.ts. */
  mathScale?: number;
  unit?: string;
  decimals?: number;
  /** When set, elements of this kind are clickable. */
  pickKind?: ElementKind | null;
  onPick?: (kind: ElementKind, index: number) => void;
  activeIndex?: number | null;
  lightTheme: boolean;
}

export function SolidElements({
  solid, annotations, showLabels, labelSettings, mathScale = 1, unit = "none", decimals = 2,
  pickKind, onPick, activeIndex, lightTheme,
}: Props) {
  const topo: Topology = useMemo(() => topologyFor(solid), [solid]);
  const ls = labelSettings ?? DEFAULT_LABEL_SETTINGS;
  const center = useMemo(() => bodyCenter(solid), [solid]);

  const highlights = annotations.filter((a) => a.type === "highlight");
  const labels = annotations.filter((a) => a.type === "label");

  const colorOf = (kind: ElementKind, index: number) =>
    highlights.find((a) => a.target.kind === kind && a.target.index === index)?.color;

  /** Colour density (0.1–1) chosen by the teacher for this highlight. */
  const densityOf = (kind: ElementKind, index: number) =>
    highlights.find((a) => a.target.kind === kind && a.target.index === index)?.style?.opacity ?? 1;

  /** The teacher's label annotation for this element, if they added one. */
  const labelFor = (kind: ElementKind, index: number) =>
    labels.find((a) => a.target.kind === kind && a.target.index === index);

  const fmt = (n: number) => formatMeasure(n * mathScale, unit, decimals, 1);



  return (
    <group>
      {/* Highlights */}
      {topo.faces.map((f) => {
        const c = colorOf("face", f.index);
        if (!c) return null;
        return <FaceShape key={`hf${f.index}`} face={f} solid={solid} color={c} opacity={0.45 * densityOf("face", f.index)} offset={0.006} />;
      })}
      {topo.edges.map((e) => {
        const c = colorOf("edge", e.index);
        if (!c) return null;
        return <EdgeShape key={`he${e.index}`} edge={e} radius={0.045} color={c} opacity={densityOf("edge", e.index)} />;
      })}
      {topo.vertices.map((v) => {
        const c = colorOf("vertex", v.index);
        if (!c) return null;
        return (
          <mesh key={`hv${v.index}`} position={v.position}>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshBasicMaterial color={c} transparent opacity={densityOf("vertex", v.index)} />
          </mesh>
        );
      })}

      {/* Active (just-picked) element outline */}
      {pickKind && activeIndex != null && (() => {
        const c = "#fbbf24";
        if (pickKind === "face" && topo.faces[activeIndex]) {
          return <FaceShape face={topo.faces[activeIndex]} solid={solid} color={c} opacity={0.25} offset={0.004} />;
        }
        if (pickKind === "edge" && topo.edges[activeIndex]) {
          return <EdgeShape edge={topo.edges[activeIndex]} radius={0.055} color={c} opacity={0.85} />;
        }
        if (pickKind === "vertex" && topo.vertices[activeIndex]) {
          return (
            <mesh position={topo.vertices[activeIndex].position}>
              <sphereGeometry args={[0.11, 16, 12]} />
              <meshBasicMaterial color={c} transparent opacity={0.85} />
            </mesh>
          );
        }
        return null;
      })()}

      {/* Textbook labels — real 3D text welded to the geometry */}
      {showLabels && (
        <group>
          {topo.vertices.map((v) => {
            const ann = labelFor("vertex", v.index);
            if (!ann || !ls.vertices) return null;
            const st = ann.style ?? {};
            const frame = frameFor("vertex", v, center);
            return (
              <Label3D
                key={`lv${v.index}`}
                text={st.labelText ?? ann.text ?? v.label}
                position={frame.anchor}
                offsetDir={frame.offsetDir}
                offset={0.24}
                accent={st.lineColor ?? colorOf("vertex", v.index) ?? ann.color ?? "#38bdf8"}
                light={lightTheme}
                size={st.labelSize ?? 0.16}
                density={st.opacity ?? 1}
                hideOccluded={ls.hideOccluded}
              />
            );
          })}

          {topo.edges.map((e) => {
            const ann = labelFor("edge", e.index);
            if (!ann || !ls.edges) return null;
            const st = ann.style ?? {};
            const frame = frameFor("edge", e, center);
            const length =
              e.shape === "straight"
                ? Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2])
                : 2 * Math.PI * e.radius;
            const display = ls.measurements ? ls.edgeDisplay : "name";
            const text = st.labelText ?? ann.text ?? edgeLabelText(e.label, fmt(length), display);
            return (
              <Label3D
                key={`le${e.index}`}
                text={text}
                position={frame.anchor}
                offsetDir={frame.offsetDir}
                offset={0.22}
                alignDir={frame.alignDir ?? null}
                accent={st.lineColor ?? colorOf("edge", e.index) ?? ann.color ?? "#f59e0b"}
                light={lightTheme}
                size={st.labelSize ?? 0.155}
                density={st.opacity ?? 1}
                hideOccluded={ls.hideOccluded}
                noLayout
              />
            );
          })}

          {topo.faces.map((f) => {
            const ann = labelFor("face", f.index);
            if (!ann || !ls.faces) return null;
            const st = ann.style ?? {};
            const frame = frameFor("face", f, center);
            return (
              <Label3D
                key={`lf${f.index}`}
                text={st.labelText ?? ann.text ?? f.label}
                position={frame.anchor}
                offsetDir={frame.offsetDir}
                offset={0.14}
                accent={st.lineColor ?? colorOf("face", f.index) ?? ann.color ?? "#a78bfa"}
                light={lightTheme}
                size={st.labelSize ?? 0.16}
                density={st.opacity ?? 1}
                hideOccluded={ls.hideOccluded}
              />
            );
          })}
        </group>

      )}

      {showLabels && (
        <ConstructionLayer
          solid={solid}
          settings={ls}
          annotations={annotations}
          mathScale={mathScale}
          light={lightTheme}
          unit={unit}
          decimals={decimals}
        />
      )}


      {/* Invisible pick proxies for the active element kind */}
      {pickKind === "face" && topo.faces.map((f) => (
        <group key={`pf${f.index}`} onPointerDown={(e) => { e.stopPropagation(); onPick?.("face", f.index); }}>
          <FaceShape face={f} solid={solid} color="#ffffff" opacity={0.001} offset={0.002} />
        </group>
      ))}
      {pickKind === "edge" && topo.edges.map((e) => (
        <group key={`pe${e.index}`} onPointerDown={(ev) => { ev.stopPropagation(); onPick?.("edge", e.index); }}>
          <EdgeShape edge={e} radius={0.07} color="#ffffff" opacity={0.001} />
        </group>
      ))}
      {pickKind === "vertex" && topo.vertices.map((v) => (
        <mesh
          key={`pv${v.index}`}
          position={v.position}
          onPointerDown={(ev) => { ev.stopPropagation(); onPick?.("vertex", v.index); }}
        >
          <sphereGeometry args={[0.16, 12, 10]} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default SolidElements;
