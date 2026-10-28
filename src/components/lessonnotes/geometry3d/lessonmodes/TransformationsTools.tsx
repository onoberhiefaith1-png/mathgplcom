// Lesson Mode: Transformations — preview a transformation of the selected
// solid as a ghost, then Apply to bake it into the solid.

import { useState } from "react";
import { RotateCw, FlipHorizontal, Move, Maximize, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { newId, type Annotation3D, type Scene3D, type Solid3D, type Vec3 } from "@/lib/geometry3d/scene3d";
import { applyTransform, describeTransform, type TransformKind, type TransformSpec } from "@/lib/geometry3d/transforms";

interface Props {
  solid: Solid3D | null;
  scene: Scene3D;
  setScene: (u: (prev: Scene3D) => Scene3D) => void;
}

export function TransformationsTools({ solid, scene, setScene }: Props) {
  const [kind, setKind] = useState<TransformKind>("rotate");
  const [angle, setAngle] = useState(90);
  const [axis, setAxis] = useState<TransformSpec["axis"]>("y");
  const [vector, setVector] = useState<Vec3>([1, 0, 0]);
  const [factor, setFactor] = useState(1.5);
  const [center, setCenter] = useState<"origin" | "centroid">("centroid");
  const [history, setHistory] = useState<string[]>([]);

  if (!solid) {
    return (
      <div className="h-full border-l border-foreground/10 bg-background p-4">
        <p className="text-xs text-muted-foreground">Select a solid to transform.</p>
      </div>
    );
  }

  const spec: TransformSpec = { kind, angleDeg: angle, axis, vector, factor, center };

  const preview = () => {
    setScene((prev) => {
      const rest = (prev.annotations ?? []).filter((a) => !(a.type === "ghost" && a.target.solidId === solid.id));
      return {
        ...prev,
        annotations: [
          ...rest,
          { id: newId("gh"), type: "ghost", visible: true, target: { solidId: solid.id, kind: "solid" }, data: spec as unknown as Record<string, unknown> } as Annotation3D,
        ],
      };
    });
  };

  const clearPreview = () => setScene((prev) => ({
    ...prev,
    annotations: (prev.annotations ?? []).filter((a) => !(a.type === "ghost" && a.target.solidId === solid.id)),
  }));

  const apply = () => {
    const next = applyTransform(solid, spec);
    setScene((prev) => ({
      ...prev,
      objects: prev.objects.map((o) => (o.id === solid.id ? next : o)),
      annotations: (prev.annotations ?? []).filter((a) => !(a.type === "ghost" && a.target.solidId === solid.id)),
    }));
    setHistory((h) => [describeTransform(spec), ...h].slice(0, 6));
  };

  const kindBtn = (k: TransformKind, Icon: typeof RotateCw, label: string) => (
    <button key={k} onClick={() => setKind(k)}
      title={label}
      className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] ${kind === k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
    ><Icon className="h-3.5 w-3.5" />{label}</button>
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <p className="text-sm font-semibold">Transformations</p>

      <div className="flex flex-wrap gap-1">
        {kindBtn("rotate", RotateCw, "Rotate")}
        {kindBtn("reflect", FlipHorizontal, "Reflect")}
        {kindBtn("translate", Move, "Translate")}
        {kindBtn("scale", Maximize, "Scale")}
      </div>

      {kind === "rotate" && (
        <div className="space-y-2 rounded-md border border-border p-2">
          <div className="flex gap-1">
            {(["x", "y", "z"] as const).map((a) => (
              <button key={a} onClick={() => setAxis(a)}
                className={`flex-1 rounded px-2 py-1 text-[11px] ${axis === a ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >{a.toUpperCase()}</button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            Angle: <span className="font-mono text-foreground">{angle}°</span>
            <input type="range" min={-180} max={180} step={5} value={angle} onChange={(e) => setAngle(+e.target.value)} />
          </label>
        </div>
      )}
      {kind === "reflect" && (
        <div className="flex gap-1 rounded-md border border-border p-2">
          {(["xy", "yz", "xz"] as const).map((a) => (
            <button key={a} onClick={() => setAxis(a)}
              className={`flex-1 rounded px-2 py-1 text-[11px] ${axis === a ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >{a.toUpperCase()} plane</button>
          ))}
        </div>
      )}
      {kind === "translate" && (
        <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-2">
          {(["Δx", "Δy", "Δz"] as const).map((lbl, i) => (
            <label key={lbl} className="flex flex-col gap-1 text-center text-[10px] text-muted-foreground">
              {lbl}
              <input type="number" step="0.1" value={vector[i]}
                onChange={(e) => setVector((prev) => { const n = [...prev] as Vec3; n[i] = +e.target.value; return n; })}
                className="rounded border border-border bg-background px-1 py-1 text-xs" />
            </label>
          ))}
        </div>
      )}
      {kind === "scale" && (
        <div className="space-y-2 rounded-md border border-border p-2">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            Factor: <span className="font-mono text-foreground">×{factor.toFixed(2)}</span>
            <input type="range" min={0.2} max={3} step={0.05} value={factor} onChange={(e) => setFactor(+e.target.value)} />
          </label>
          <div className="flex gap-1">
            {(["origin", "centroid"] as const).map((c) => (
              <button key={c} onClick={() => setCenter(c)}
                className={`flex-1 rounded px-2 py-1 text-[11px] ${center === c ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >About {c}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1">
        <Button size="sm" variant="secondary" onClick={preview} className="h-7 flex-1 gap-1.5 text-[11px]">
          <Play className="h-3.5 w-3.5" /> Preview
        </Button>
        <Button size="sm" onClick={apply} className="h-7 flex-1 text-[11px]">Apply</Button>
        <Button size="sm" variant="ghost" onClick={clearPreview} className="h-7 px-2"><X className="h-3.5 w-3.5" /></Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{describeTransform(spec)}</p>

      {history.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">History</p>
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {history.map((h, i) => <li key={i} className="rounded bg-muted/50 px-2 py-1">{h}</li>)}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
export default TransformationsTools;
