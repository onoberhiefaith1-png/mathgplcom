// Lesson Mode: Coordinate Geometry (3D) — live vertex coordinates, editable
// custom points, and the distance / midpoint working between two points.

import { useState } from "react";
import { Axis3d, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { topologyFor } from "@/lib/geometry3d/topology";
import { toWorld, distance } from "@/lib/geometry3d/measure";
import { formatMeasure, formatValue } from "@/lib/geometry3d/units";
import { newId, type Annotation3D, type Scene3D, type Solid3D, type Vec3 } from "@/lib/geometry3d/scene3d";
import { PanelSection, UnitControls, TeachingNotes } from "./TeachingPanelKit";

const WORLD_ID = "__world";

interface Props {
  solid: Solid3D | null;
  scene: Scene3D;
  setScene: (u: (prev: Scene3D) => Scene3D) => void;
  unit: string;
  setUnit: (u: string) => void;
  decimals: number;
  setDecimals: (n: number) => void;
}

export function CoordinatesTools({ solid, scene, setScene, unit, setUnit, decimals, setDecimals }: Props) {
  const [coords, setCoords] = useState<Vec3>([0, 0, 0]);
  const [joinFirst, setJoinFirst] = useState<string | null>(null);

  const points = (scene.annotations ?? []).filter((a) => a.type === "point" && a.target.solidId === WORLD_ID);
  const segments = (scene.annotations ?? []).filter((a) => a.type === "segment" && a.target.solidId === WORLD_ID);

  const addPoint = () => {
    setScene((prev) => ({
      ...prev,
      annotations: [
        ...(prev.annotations ?? []),
        {
          id: newId("pt"), type: "point", visible: true, target: { solidId: WORLD_ID, kind: "point" },
          position: [...coords] as Vec3, text: `P${points.length + 1}`, color: "#fbbf24",
        } as Annotation3D,
      ],
    }));
  };

  const movePoint = (id: string, axis: 0 | 1 | 2, value: number) => {
    setScene((prev) => ({
      ...prev,
      annotations: (prev.annotations ?? []).map((a) => {
        if (a.id !== id || !a.position) return a;
        const next = [...a.position] as Vec3;
        next[axis] = value;
        return { ...a, position: next };
      }),
    }));
  };

  const removePoint = (id: string) => setScene((prev) => ({
    ...prev,
    annotations: (prev.annotations ?? []).filter((a) => a.id !== id && !((a.data?.indices as string[])?.includes(id))),
  }));

  const clearAll = () => setScene((prev) => ({
    ...prev,
    annotations: (prev.annotations ?? []).filter((a) => a.target.solidId !== WORLD_ID),
  }));

  const startJoin = (id: string) => {
    if (!joinFirst) { setJoinFirst(id); return; }
    if (joinFirst === id) { setJoinFirst(null); return; }
    const ids = [joinFirst, id];
    setScene((prev) => ({
      ...prev,
      annotations: [
        ...(prev.annotations ?? []),
        { id: newId("seg"), type: "segment", visible: true, target: { solidId: WORLD_ID, kind: "pointPair" }, data: { indices: ids }, color: "#38bdf8" } as Annotation3D,
      ],
    }));
    setJoinFirst(null);
  };

  const vertexRows = solid
    ? topologyFor(solid).vertices.map((v) => ({ label: v.label, world: toWorld(solid, v.position) }))
    : [];

  const fmtCoord = (v: Vec3) => `(${v.map((n) => formatValue(n, decimals)).join(", ")})`;

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div className="flex items-center gap-1.5">
        <Axis3d className="h-4 w-4" />
        <p className="text-sm font-semibold">Coordinate Geometry</p>
      </div>

      {solid && vertexRows.length > 0 && (
        <PanelSection title="Vertex coordinates (live)">
          <div className="max-h-44 space-y-0.5 overflow-y-auto">
            {vertexRows.map((v) => (
              <div key={v.label} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px]">
                <span className="font-semibold">{v.label}</span>
                <span className="font-mono text-muted-foreground">{fmtCoord(v.world)}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Move or resize the solid in Workspace Mode and these coordinates update instantly.
          </p>
        </PanelSection>
      )}

      <PanelSection title="Add a point">
        <div className="grid grid-cols-3 gap-1">
          {(["x", "y", "z"] as const).map((k, i) => (
            <label key={k} className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
              {k}
              <input type="number" step="0.1" value={coords[i]}
                onChange={(e) => setCoords((prev) => { const n = [...prev] as Vec3; n[i] = +e.target.value; return n; })}
                className="rounded border border-border bg-background px-1 py-1 text-xs" />
            </label>
          ))}
        </div>
        <Button size="sm" onClick={addPoint} className="mt-2 h-7 w-full gap-1.5 text-[11px]">
          <Plus className="h-3.5 w-3.5" /> Add point
        </Button>
      </PanelSection>

      {points.length > 0 && (
        <PanelSection title="Points (editable)">
          <div className="space-y-1.5">
            {points.map((p) => (
              <div key={p.id} className="rounded border border-border/70 p-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold">{p.text}</span>
                  <div className="flex gap-1">
                    <button onClick={() => startJoin(p.id)}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${joinFirst === p.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >Join</button>
                    <button onClick={() => removePoint(p.id)} className="rounded px-1 text-[10px] hover:bg-destructive/20">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {(["x", "y", "z"] as const).map((k, i) => (
                    <input key={k} type="number" step="0.1"
                      value={(p.position as Vec3)[i]}
                      onChange={(e) => movePoint(p.id, i as 0 | 1 | 2, +e.target.value)}
                      className="rounded border border-border bg-background px-1 py-0.5 text-[11px]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      {segments.length > 0 && (
        <PanelSection title="Distances between points">
          <div className="space-y-1.5">
            {segments.map((s) => {
              const ids = (s.data?.indices as string[]) ?? [];
              const a = points.find((p) => p.id === ids[0]);
              const b = points.find((p) => p.id === ids[1]);
              if (!a || !b) return null;
              const pa = a.position as Vec3, pb = b.position as Vec3;
              const d = distance(pa, pb);
              const mid: Vec3 = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
              return (
                <div key={s.id} className="rounded border border-border/70 p-1.5 text-[11px]">
                  <p className="font-semibold">{a.text}{b.text}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {"d = \u221A[("}{formatValue(pb[0] - pa[0], decimals)}{")\u00B2 + ("}{formatValue(pb[1] - pa[1], decimals)}{")\u00B2 + ("}{formatValue(pb[2] - pa[2], decimals)}{")\u00B2]"}
                  </p>
                  <p className="mt-0.5">Distance = <span className="font-semibold text-primary">{formatMeasure(d, unit, decimals, 1)}</span></p>
                  <p className="text-[10px] text-muted-foreground">Midpoint = {fmtCoord(mid)}</p>
                </div>
              );
            })}
          </div>
        </PanelSection>
      )}

      <PanelSection title="Teaching information" defaultOpen={false}>
        <TeachingNotes
          why={"In three dimensions a point needs three coordinates (x, y, z). Distance extends Pythagoras' theorem to space: d = \u221A(\u0394x\u00B2 + \u0394y\u00B2 + \u0394z\u00B2)."}
          how={["Write down both coordinates.", "Subtract to find \u0394x, \u0394y and \u0394z.", "Square, add, then square root."]}
          notes={["The midpoint is the mean of each coordinate.", "Setting one coordinate to 0 projects the point onto a coordinate plane."]}
          mistakes={["Forgetting the z-term.", "Subtracting in an inconsistent order."]}
        />
      </PanelSection>

      <PanelSection title="Units & precision" defaultOpen={false}>
        <UnitControls unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals} />
      </PanelSection>

      {(points.length > 0 || segments.length > 0) && (
        <Button size="sm" variant="ghost" onClick={clearAll} className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Clear points
        </Button>
      )}
    </div>
  );
}
export default CoordinatesTools;
