// Lesson Mode: Cross Sections — slicing plane with analytic 2D section view,
// preset planes, the name of the 2D shape, its area and perimeter.

import { useEffect, useMemo } from "react";
import { Scissors } from "lucide-react";
import { sliceSolid, type PlaneAxis } from "@/lib/geometry3d/crossSection";
import { shapeMath, type Dimension } from "@/lib/geometry3d/formulaLibrary";
import { formatMeasure } from "@/lib/geometry3d/units";
import { newId, type Annotation3D, type Scene3D, type Solid3D } from "@/lib/geometry3d/scene3d";
import { PanelSection, UnitControls, DimensionEditor, TeachingNotes } from "./TeachingPanelKit";

const WORLD_ID = "__world";

interface Props {
  solid: Solid3D | null;
  scene: Scene3D;
  setScene: (u: (prev: Scene3D) => Scene3D) => void;
  unit: string;
  setUnit: (u: string) => void;
  decimals: number;
  setDecimals: (n: number) => void;
  onParam: (key: string, rawValue: number) => void;
}

export function CrossSectionsTools({ solid, scene, setScene, unit, setUnit, decimals, setDecimals, onParam }: Props) {
  const planeAnn = (scene.annotations ?? []).find((a) => a.type === "plane" && a.target.solidId === WORLD_ID) ?? null;
  const axis = (planeAnn?.data?.axis as PlaneAxis) ?? "y";
  const offset = (planeAnn?.data?.offset as number) ?? 0;

  useEffect(() => {
    if (!planeAnn) {
      setScene((prev) => ({
        ...prev,
        annotations: [
          ...(prev.annotations ?? []),
          { id: newId("pl"), type: "plane", visible: true, target: { solidId: WORLD_ID, kind: "world" }, data: { axis: "y", offset: 0 } } as Annotation3D,
        ],
      }));
    }
    // The slicing plane belongs to this mode only — remove it on exit.
    return () => {
      setScene((prev) => ({
        ...prev,
        annotations: (prev.annotations ?? []).filter(
          (a) => !(a.type === "plane" && a.target.solidId === WORLD_ID),
        ),
      }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPlane = (patch: { axis?: PlaneAxis; offset?: number }) => {
    setScene((prev) => ({
      ...prev,
      annotations: (prev.annotations ?? []).map((a) =>
        a.type === "plane" && a.target.solidId === WORLD_ID
          ? { ...a, data: { ...(a.data ?? {}), ...patch } }
          : a,
      ),
    }));
  };

  const section = useMemo(() => (solid ? sliceSolid(solid, { axis, offset }) : null), [solid, axis, offset]);
  const m = solid ? shapeMath(solid) : null;

  const perimeter = useMemo(() => {
    if (!section) return 0;
    let s = 0;
    const pts = section.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    return s;
  }, [section]);

  const shapeName = section ? section.label.split(/[\s(]/)[0] : "";

  const setDim = (key: string, value: number) => {
    if (!m) return;
    const d = m.dimensions.find((x) => x.key === key) as Dimension | undefined;
    onParam(key, d ? value / (d.scaleFactor || 1) : value);
  };

  const axisBtn = (a: PlaneAxis, label: string) => (
    <button key={a} onClick={() => setPlane({ axis: a })}
      className={`flex-1 rounded px-2 py-1 text-[11px] ${axis === a ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
    >{label}</button>
  );

  const height = (solid?.params?.height ?? solid?.params?.size ?? 2) * Math.abs(solid?.scale[1] ?? 1);
  const presets: [string, PlaneAxis, number][] = [
    ["Horizontal · middle", "y", 0],
    ["Horizontal · upper quarter", "y", height / 4],
    ["Horizontal · lower quarter", "y", -height / 4],
    ["Vertical · through centre (x)", "x", 0],
    ["Vertical · through centre (z)", "z", 0],
  ];

  // 2D preview scale
  const svg = useMemo(() => {
    if (!section) return null;
    const xs = section.points.map((p) => p[0]);
    const ys = section.points.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = Math.max(0.1, maxX - minX), h = Math.max(0.1, maxY - minY);
    const scale = 120 / Math.max(w, h);
    const pts = section.points.map((p) => `${(p[0] - minX) * scale + 20},${(p[1] - minY) * scale + 20}`).join(" ");
    return { width: w * scale + 40, height: h * scale + 40, pts };
  }, [section]);

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div className="flex items-center gap-1.5">
        <Scissors className="h-4 w-4" />
        <p className="text-sm font-semibold">Cross Sections{m ? ` · ${m.name}` : ""}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">Move a plane through the solid and read its section.</p>

      <div className="flex gap-1">{axisBtn("y", "Horizontal")}{axisBtn("x", "Vertical X")}{axisBtn("z", "Vertical Z")}</div>

      <div className="grid gap-1">
        {presets.map(([label, a, o]) => (
          <button key={label} type="button" onClick={() => setPlane({ axis: a, offset: o })}
            className="rounded border border-border px-2 py-1 text-left text-[10.5px] hover:bg-muted">
            {label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Plane offset: <span className="font-mono text-foreground">{offset.toFixed(2)}</span>
        <input type="range" min={-3} max={3} step={0.05} value={offset} onChange={(e) => setPlane({ offset: +e.target.value })} className="accent-primary" />
      </label>

      {solid && section && svg && (
        <div className="space-y-2 rounded-md border border-border p-2">
          <p className="text-sm font-semibold">{shapeName}</p>
          <p className="text-[11px] text-muted-foreground">{section.label}</p>
          <svg viewBox={`0 0 ${svg.width} ${svg.height}`} className="h-auto w-full">
            <polygon points={svg.pts} fill="#38bdf8" fillOpacity={0.35} stroke="#0ea5e9" strokeWidth={1.5} />
          </svg>
          <div className="divide-y divide-foreground/10">
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] text-muted-foreground">Area</span>
              <span className="text-xs font-semibold text-primary">{formatMeasure(section.area, unit, decimals, 2)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] text-muted-foreground">Perimeter</span>
              <span className="text-xs font-medium">{formatMeasure(perimeter, unit, decimals, 1)}</span>
            </div>
          </div>
        </div>
      )}
      {solid && !section && <p className="text-[11px] text-amber-500">The plane misses this solid (or this cut is not supported analytically) — try another offset or axis.</p>}
      {!solid && <p className="text-xs text-muted-foreground">Select a solid to slice.</p>}

      {m && (
        <>
          <PanelSection title="Dimensions (editable)">
            <DimensionEditor dimensions={m.dimensions} unit={unit} decimals={decimals} onChange={setDim} />
          </PanelSection>
          <PanelSection title="Teaching information" defaultOpen={false}>
            <TeachingNotes
              why="A cross-section is the 2D shape revealed when a plane cuts a solid. For a prism, every cut parallel to the base gives the same shape — that is what makes it a prism."
              how={["Choose the direction of the cut.", "Describe the 2D shape produced.", "Calculate its area using the 2D formula."]}
              notes={["Horizontal cuts of a cone or pyramid give similar shapes that shrink towards the apex.", "Any plane cut of a sphere gives a circle."]}
              mistakes={["Assuming every cross-section of a pyramid is the same size.", "Mixing up the cross-section area with the surface area."]}
            />
          </PanelSection>
          <PanelSection title="Units & precision" defaultOpen={false}>
            <UnitControls unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals} />
          </PanelSection>
        </>
      )}
    </div>
  );
}
export default CrossSectionsTools;
