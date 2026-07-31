// Lesson Mode: Surface Area — shade faces, see each face's contribution to
// the total, read full working for lateral and total surface area.

import { useEffect, useState } from "react";
import { Paintbrush, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { topologyFor } from "@/lib/geometry3d/topology";
import { faceArea } from "@/lib/geometry3d/measure";
import { shapeMath, type Dimension } from "@/lib/geometry3d/formulaLibrary";
import { formatMeasure, formatValue } from "@/lib/geometry3d/units";
import { workedExample, workedExampleText } from "@/lib/geometry3d/workedExample";
import { newId, type Annotation3D, type Scene3D, type Solid3D } from "@/lib/geometry3d/scene3d";
import {
  PanelSection, UnitControls, DimensionEditor, WorkingBlock, TeachingNotes, CopyButton,
} from "./TeachingPanelKit";

const PALETTE = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#f472b6", "#f87171"];
type ElementKind = "face" | "edge" | "vertex";

interface Props {
  solid: Solid3D | null;
  scene: Scene3D;
  setScene: (u: (prev: Scene3D) => Scene3D) => void;
  pick: { solidId: string; kind: ElementKind; index: number } | null;
  clearPick: () => void;
  setPickKind: (k: ElementKind) => void;
  unit: string;
  setUnit: (u: string) => void;
  decimals: number;
  setDecimals: (n: number) => void;
  onParam: (key: string, rawValue: number) => void;
  onGuide?: (guide: string | null) => void;
}

export function SurfaceAreaTools({
  solid, scene, setScene, pick, clearPick, setPickKind,
  unit, setUnit, decimals, setDecimals, onParam, onGuide,
}: Props) {
  const solidId = solid?.id ?? null;
  const [showExample, setShowExample] = useState(false);

  useEffect(() => { setPickKind("face"); }, [setPickKind]);

  useEffect(() => {
    if (!pick || !solidId || pick.solidId !== solidId || pick.kind !== "face") return;
    const index = pick.index;
    setScene((prev) => {
      const existing = (prev.annotations ?? []).find(
        (a) => a.type === "shade" && a.target.solidId === solidId && a.target.index === index,
      );
      const rest = (prev.annotations ?? []).filter(
        (a) => !(a.type === "shade" && a.target.solidId === solidId && a.target.index === index),
      );
      if (existing) return { ...prev, annotations: rest };
      const count = rest.filter((a) => a.type === "shade" && a.target.solidId === solidId).length;
      const a: Annotation3D = { id: newId("sh"), type: "shade", visible: true, target: { solidId, kind: "face", index }, color: PALETTE[count % PALETTE.length] };
      return { ...prev, annotations: [...rest, a] };
    });
    clearPick();
  }, [pick, solidId, clearPick, setScene]);

  if (!solid) {
    return (
      <div className="h-full overflow-y-auto border-l border-foreground/10 bg-background p-4">
        <p className="text-xs text-muted-foreground">Pick a solid and click faces to shade them.</p>
      </div>
    );
  }

  const topo = topologyFor(solid);
  const m = shapeMath(solid);
  const example = workedExample(solid, "totalSA", unit, decimals);
  const fmtA = (n: number) => formatMeasure(n, unit, decimals, 2);

  const setDim = (key: string, value: number) => {
    const d = m.dimensions.find((x) => x.key === key) as Dimension | undefined;
    onParam(key, d ? value / (d.scaleFactor || 1) : value);
  };

  const shades = (scene.annotations ?? []).filter((a) => a.type === "shade" && a.target.solidId === solid.id);
  const shadeMap = new Map<number, string>();
  for (const s of shades) if (s.target.kind === "face" && s.target.index != null) shadeMap.set(s.target.index, s.color ?? PALETTE[0]);

  const faceAreas = topo.faces.map((f) => faceArea(solid, f));
  const total = faceAreas.reduce((a, b) => a + b, 0);
  const shadedTotal = Array.from(shadeMap.keys()).reduce((sum, i) => sum + (faceAreas[i] ?? 0), 0);

  const setShade = (index: number, color: string | null) => {
    setScene((prev) => {
      const rest = (prev.annotations ?? []).filter((a) => !(a.type === "shade" && a.target.solidId === solid.id && a.target.index === index));
      if (color === null) return { ...prev, annotations: rest };
      const a: Annotation3D = { id: newId("sh"), type: "shade", visible: true, target: { solidId: solid.id, kind: "face", index }, color };
      return { ...prev, annotations: [...rest, a] };
    });
  };

  const shadeSet = (indices: number[]) => {
    const added: Annotation3D[] = indices.map((i, k) => ({
      id: newId("sh"), type: "shade", visible: true, target: { solidId: solid.id, kind: "face", index: i }, color: PALETTE[k % PALETTE.length],
    }));
    setScene((prev) => ({
      ...prev,
      annotations: [...(prev.annotations ?? []).filter((a) => !(a.type === "shade" && a.target.solidId === solid.id)), ...added],
    }));
  };
  const shadeAll = () => shadeSet(topo.faces.map((_, i) => i));
  const shadeLateral = () => shadeSet(topo.faces.flatMap((f, i) => (f.shape === "polygon" && Math.abs(f.normal[1]) > 0.9 ? [] : [i])));
  const clearAll = () => shadeSet([]);

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div className="flex items-center gap-1.5">
        <Paintbrush className="h-4 w-4" />
        <p className="text-sm font-semibold">Surface Area · {m.name}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Click any face in the 3D view to shade it — shaded faces glow and add to the running total.
      </p>

      <div className="flex gap-1">
        <Button size="sm" variant="secondary" className="h-7 flex-1 text-[11px]" onClick={shadeLateral}>Lateral</Button>
        <Button size="sm" variant="secondary" className="h-7 flex-1 text-[11px]" onClick={shadeAll}>Total</Button>
      </div>

      <div className="divide-y divide-foreground/10 rounded-md border border-border">
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">Shaded ({shadeMap.size} faces)</span>
          <span className="text-xs font-semibold text-primary">{fmtA(shadedTotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">Shaded share of total</span>
          <span className="text-xs font-medium">{total > 0 ? `${formatValue((shadedTotal / total) * 100, 1)}%` : "—"}</span>
        </div>
      </div>

      <PanelSection title="Dimensions (editable)">
        <DimensionEditor dimensions={m.dimensions} unit={unit} decimals={decimals} onChange={setDim} onHover={(g) => onGuide?.(g)} />
      </PanelSection>

      <PanelSection title="Total surface area — working">
        <WorkingBlock working={m.totalSA} unit={unit} decimals={decimals} />
      </PanelSection>

      {m.lateralSA && (
        <PanelSection title={m.lateralSA.title + " — working"} defaultOpen={false}>
          <WorkingBlock working={m.lateralSA} unit={unit} decimals={decimals} accent="text-sky-500" />
        </PanelSection>
      )}

      <PanelSection title="Face-by-face contribution">
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {topo.faces.map((f, i) => {
            const share = total > 0 ? (faceAreas[i] / total) * 100 : 0;
            const shaded = shadeMap.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setShade(i, shaded ? null : PALETTE[i % PALETTE.length])}
                className={`w-full rounded px-1.5 py-1 text-left text-[11px] transition hover:bg-muted/60 ${shaded ? "bg-muted/50" : ""}`}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm border border-border"
                      style={{ background: shaded ? shadeMap.get(i) : "transparent" }}
                    />
                    {f.label}
                  </span>
                  <span className="font-medium">{fmtA(faceAreas[i])}</span>
                </span>
                <span className="mt-0.5 block h-1 w-full overflow-hidden rounded bg-muted">
                  <span className="block h-full rounded bg-primary/70" style={{ width: `${share}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection title="Teaching information" defaultOpen={false}>
        <TeachingNotes why={m.why.surfaceArea} how={m.how.surfaceArea} notes={m.notes} mistakes={m.mistakes} />
      </PanelSection>

      <PanelSection title="Units & precision" defaultOpen={false}>
        <UnitControls unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals} />
      </PanelSection>

      {example && (
        <div className="rounded-md border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Worked example</p>
            <div className="flex gap-1">
              <button type="button" onClick={() => setShowExample((v) => !v)}
                className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted">
                {showExample ? "Hide" : "Generate"}
              </button>
              {showExample && <CopyButton text={workedExampleText(example)} />}
            </div>
          </div>
          {showExample && (
            <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed">
              <p className="font-medium">{example.question}</p>
              <ol className="space-y-0.5">
                {example.steps.map((s, i) => (
                  <li key={i} className="font-mono text-[10.5px] text-muted-foreground">{s.label}: {s.line}</li>
                ))}
              </ol>
              <p className="font-semibold text-primary">{example.answer}</p>
            </div>
          )}
        </div>
      )}

      <Button size="sm" variant="ghost" onClick={clearAll} className="gap-1.5">
        <Trash2 className="h-3.5 w-3.5" /> Clear shades
      </Button>
    </div>
  );
}
export default SurfaceAreaTools;
