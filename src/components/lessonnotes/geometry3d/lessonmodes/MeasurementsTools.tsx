// Lesson Mode: Measurements — length / area / circumference of elements,
// distance between two vertices, with live editable dimensions.

import { useCallback, useEffect, useState } from "react";
import { Ruler, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { topologyFor } from "@/lib/geometry3d/topology";
import { edgeLength, faceArea } from "@/lib/geometry3d/measure";
import { shapeMath, type Dimension } from "@/lib/geometry3d/formulaLibrary";
import { formatMeasure } from "@/lib/geometry3d/units";
import { newId, type Annotation3D, type Scene3D, type Solid3D } from "@/lib/geometry3d/scene3d";
import { PanelSection, UnitControls, DimensionEditor, VariableTable, TeachingNotes } from "./TeachingPanelKit";

export type ElementKind = "face" | "edge" | "vertex";

interface Props {
  solid: Solid3D | null;
  scene: Scene3D;
  setScene: (updater: (prev: Scene3D) => Scene3D) => void;
  pick: { solidId: string; kind: ElementKind; index: number } | null;
  clearPick: () => void;
  pickKind: ElementKind;
  setPickKind: (k: ElementKind) => void;
  unit: string;
  setUnit: (u: string) => void;
  decimals: number;
  setDecimals: (n: number) => void;
  onParam: (key: string, rawValue: number) => void;
  onGuide?: (guide: string | null) => void;
}

export function MeasurementsTools({
  solid, scene, setScene, pick, clearPick, pickKind, setPickKind,
  unit, setUnit, decimals, setDecimals, onParam, onGuide,
}: Props) {
  const [distancePair, setDistancePair] = useState<number[]>([]);
  const solidId = solid?.id ?? null;

  const addMeasurement = useCallback((kind: "face" | "edge", index: number) => {
    if (!solidId) return;
    setScene((prev) => {
      const list = prev.annotations ?? [];
      const dup = list.some((a) => a.type === "measurement" && a.target.solidId === solidId && a.target.kind === kind && a.target.index === index);
      if (dup) return prev;
      const a: Annotation3D = { id: newId("m"), type: "measurement", visible: true, target: { solidId, kind, index } };
      return { ...prev, annotations: [...list, a] };
    });
  }, [solidId, setScene]);

  // Consume the latest pick.
  useEffect(() => {
    if (!pick || !solidId || pick.solidId !== solidId) return;
    if (pickKind === "edge" || pickKind === "face") {
      addMeasurement(pickKind, pick.index);
    } else if (pickKind === "vertex") {
      setDistancePair((prevPair) => {
        const pair = [...prevPair, pick.index];
        if (pair.length === 2 && pair[0] !== pair[1]) {
          setScene((prev) => ({
            ...prev,
            annotations: [
              ...(prev.annotations ?? []),
              { id: newId("s"), type: "segment", visible: true, target: { solidId, kind: "vertexPair", indices: pair } },
            ],
          }));
          return [];
        }
        return pair.length === 2 ? [] : pair;
      });
    }
    clearPick();
  }, [pick, solidId, pickKind, addMeasurement, clearPick, setScene]);

  if (!solid) {
    return (
      <div className="h-full overflow-y-auto border-l border-foreground/10 bg-background p-4">
        <p className="text-xs text-muted-foreground">Click a solid to start measuring.</p>
      </div>
    );
  }

  const topo = topologyFor(solid);
  const m = shapeMath(solid);
  const fmt = (n: number, power: 1 | 2 = 1) => formatMeasure(n, unit, decimals, power);

  const setDim = (key: string, value: number) => {
    const d = m.dimensions.find((x) => x.key === key) as Dimension | undefined;
    onParam(key, d ? value / (d.scaleFactor || 1) : value);
  };

  const clearMeasurements = () => setScene((prev) => ({
    ...prev,
    annotations: (prev.annotations ?? []).filter((a) => !(a.type === "measurement" || a.type === "segment") || a.target.solidId !== solid.id),
  }));

  // Quick-measures list (all live)
  const p = solid.params ?? {};
  const radial = (Math.abs(solid.scale[0]) + Math.abs(solid.scale[2])) / 2;
  const quick: [string, string][] = [];
  if (p.radius != null) {
    quick.push(["Radius", fmt(p.radius * radial)]);
    quick.push(["Diameter", fmt(2 * p.radius * radial)]);
    quick.push(["Circumference", fmt(2 * Math.PI * p.radius * radial)]);
  }
  if (p.height != null) quick.push(["Height", fmt(p.height * Math.abs(solid.scale[1]))]);
  if (p.radius != null && p.height != null && (solid.kind === "cone" || solid.kind === "frustum")) {
    quick.push(["Slant height", fmt(Math.hypot(p.height * Math.abs(solid.scale[1]), (p.radius - (p.topRadius ?? 0)) * radial))]);
  }

  const totalEdges = topo.edges.map((e) => edgeLength(solid, e)).reduce((a, b) => a + b, 0);
  const totalArea = topo.faces.map((f) => faceArea(solid, f)).reduce((a, b) => a + b, 0);

  const kindBtn = (k: ElementKind, label: string) => (
    <button
      key={k}
      onClick={() => setPickKind(k)}
      className={`flex-1 rounded px-2 py-1 text-xs ${pickKind === k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
    >{label}</button>
  );

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div className="flex items-center gap-1.5">
        <Ruler className="h-4 w-4" />
        <p className="text-sm font-semibold">Measurements · {m.name}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Click an edge for length, a face for area, or two vertices for a distance segment.
      </p>

      <div className="flex gap-1">{kindBtn("edge", "Edge")}{kindBtn("face", "Face")}{kindBtn("vertex", "Distance")}</div>
      {pickKind === "vertex" && distancePair.length === 1 && (
        <p className="text-[11px] text-amber-500">Pick the second vertex…</p>
      )}

      <PanelSection title="Dimensions (editable)">
        <DimensionEditor dimensions={m.dimensions} unit={unit} decimals={decimals} onChange={setDim} onHover={(g) => onGuide?.(g)} />
      </PanelSection>

      <PanelSection title="Quick measures">
        <div className="divide-y divide-foreground/10">
          {quick.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-[11px] text-muted-foreground">{k}</span>
              <span className="text-xs font-medium">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-[11px] text-muted-foreground">Total edge length</span>
            <span className="text-xs font-medium">{fmt(totalEdges)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-[11px] text-muted-foreground">Surface area</span>
            <span className="text-xs font-medium">{fmt(totalArea, 2)}</span>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="What each letter means" defaultOpen={false}>
        <VariableTable variables={m.variables} unit={unit} decimals={decimals} />
      </PanelSection>

      <PanelSection title="Teaching information" defaultOpen={false}>
        <TeachingNotes
          why="Measurements of a solid are lengths (1D), areas (2D) or volumes (3D) — the units must always match the dimension."
          how={["Decide whether the quantity is a length, an area or a volume.", "Measure the dimensions needed.", "Write the answer with the correct unit and power."]}
          notes={m.notes}
          mistakes={["Giving an area in cm instead of cm\u00B2.", "Measuring a slant length when the perpendicular height is required."]}
        />
      </PanelSection>

      <PanelSection title="Units & precision" defaultOpen={false}>
        <UnitControls unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals} />
      </PanelSection>

      <Button size="sm" variant="ghost" onClick={clearMeasurements} className="gap-1.5">
        <Trash2 className="h-3.5 w-3.5" /> Clear measurements
      </Button>
      {distancePair.length > 0 && (
        <Button size="sm" variant="ghost" onClick={() => setDistancePair([])} className="gap-1.5">
          <X className="h-3.5 w-3.5" /> Cancel distance pick
        </Button>
      )}
    </div>
  );
}
export default MeasurementsTools;
