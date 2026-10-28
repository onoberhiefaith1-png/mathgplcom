// AnnotationManager — the teacher's control desk for everything drawn on the
// selected solid.
//
// The calculation engine always knows every length, area and angle. This panel
// is the *display* engine's control surface: each annotation is listed with its
// own Show / Hide switch and its own styling (line colour, thickness, opacity,
// label text and size). Nothing is ever revealed by a global button.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  availableConstructions, CONSTRUCTION_COLORS, type ConstructionKind,
} from "@/lib/geometry3d/labeling";
import { topologyFor } from "@/lib/geometry3d/topology";
import { newId, type Annotation3D, type Scene3D, type Solid3D } from "@/lib/geometry3d/scene3d";

interface Props {
  solid: Solid3D | null;
  scene: Scene3D;
  setScene: (fn: (prev: Scene3D) => Scene3D) => void;
}

const TYPE_LABEL: Record<string, string> = {
  label: "Label",
  measurement: "Measurement",
  angle: "Angle",
  shade: "Face shade",
  highlight: "Highlight",
  construction: "Construction",
  segment: "Segment",
  point: "Point",
  mark: "Mark",
  hiddenEdge: "Hidden edge",
};

const SWATCHES = ["#38bdf8", "#a78bfa", "#34d399", "#f59e0b", "#f472b6", "#f87171", "#0f172a", "#e2e8f0"];

export function AnnotationManager({ solid, scene, setScene }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(
    () => (scene.annotations ?? []).filter((a) => solid && a.target.solidId === solid.id),
    [scene.annotations, solid],
  );
  const topo = useMemo(() => (solid ? topologyFor(solid) : null), [solid]);

  if (!solid) return null;

  const update = (id: string, patch: Partial<Annotation3D>) =>
    setScene((prev) => ({
      ...prev,
      annotations: (prev.annotations ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));

  const updateStyle = (a: Annotation3D, patch: Partial<NonNullable<Annotation3D["style"]>>) =>
    update(a.id, { style: { ...(a.style ?? {}), ...patch } });

  const remove = (id: string) =>
    setScene((prev) => ({ ...prev, annotations: (prev.annotations ?? []).filter((a) => a.id !== id) }));

  const addConstruction = (kind: ConstructionKind) =>
    setScene((prev) => ({
      ...prev,
      annotations: [
        ...(prev.annotations ?? []),
        {
          id: newId("con"),
          type: "construction",
          visible: true,
          target: { solidId: solid.id, kind: "solid" },
          data: { kind },
          style: { lineColor: CONSTRUCTION_COLORS[kind], lineWidth: 2.5, opacity: 1, labelSize: 0.15 },
        } as Annotation3D,
      ],
    }));

  const describe = (a: Annotation3D) => {
    const t = TYPE_LABEL[a.type] ?? a.type;
    if (a.type === "construction") {
      const k = String(a.data?.kind ?? "");
      return `${k === "slant" ? "Slant height" : k === "topRadius" ? "Top radius" : k.charAt(0).toUpperCase() + k.slice(1)}`;
    }
    const i = a.target.index;
    if (i == null || !topo) return t;
    const name =
      a.target.kind === "edge" ? topo.edges[i]?.label
        : a.target.kind === "face" ? topo.faces[i]?.label
        : a.target.kind === "vertex" ? topo.vertices[i]?.label
        : undefined;
    return name ? `${t} ${name}` : t;
  };

  const existing = new Set(list.filter((a) => a.type === "construction").map((a) => String(a.data?.kind)));
  const addable = availableConstructions(solid).filter((c) => !existing.has(c.kind));

  return (
    <div className="space-y-2 rounded-md border border-border bg-card/50 p-2">
      <div>
        <p className="text-xs font-semibold">Annotations</p>
        <p className="text-[10px] text-muted-foreground">
          Every value is calculated in the background. Switch on only what the class should see.
        </p>
      </div>

      {addable.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Construction lines</Label>
          <div className="flex flex-wrap gap-1">
            {addable.map((c) => (
              <Button
                key={c.kind}
                size="sm"
                variant="outline"
                className="h-6 gap-1 px-2 text-[11px]"
                onClick={() => addConstruction(c.kind)}
              >
                <Plus className="h-3 w-3" /> {c.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nothing added yet — the diagram is clean.
        </p>
      ) : (
        <ul className="space-y-1">
          {list.map((a) => {
            const open = openId === a.id;
            const st = a.style ?? {};
            return (
              <li key={a.id} className="rounded border border-border/70">
                <div className="flex items-center gap-1 px-1.5 py-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-[11px]"
                    onClick={() => setOpenId(open ? null : a.id)}
                  >
                    {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{describe(a)}</span>
                  </button>
                  {a.visible ? <Eye className="h-3 w-3 text-primary" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                  <Switch
                    checked={a.visible === true}
                    onCheckedChange={(v) => update(a.id, { visible: v })}
                    aria-label={`Show ${describe(a)}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => remove(a.id)}
                    aria-label={`Delete ${describe(a)}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {open && (
                  <div className="space-y-2 border-t border-border/70 p-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Label text</Label>
                      <Input
                        value={st.labelText ?? a.text ?? ""}
                        placeholder="Automatic"
                        onChange={(e) => updateStyle(a, { labelText: e.target.value || undefined })}
                        className="h-7 text-[11px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Colour</Label>
                      <div className="flex flex-wrap gap-1">
                        {SWATCHES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Colour ${c}`}
                            onClick={() => updateStyle(a, { lineColor: c })}
                            className={cn(
                              "h-5 w-5 rounded border",
                              (st.lineColor ?? a.color) === c ? "ring-2 ring-primary" : "border-border",
                            )}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Thickness {(st.lineWidth ?? 2.5).toFixed(1)}
                      </Label>
                      <Slider
                        value={[st.lineWidth ?? 2.5]}
                        min={1} max={8} step={0.5}
                        onValueChange={([v]) => updateStyle(a, { lineWidth: v })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Opacity {Math.round((st.opacity ?? 1) * 100)}%
                      </Label>
                      <Slider
                        value={[st.opacity ?? 1]}
                        min={0.1} max={1} step={0.05}
                        onValueChange={([v]) => updateStyle(a, { opacity: v })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Label size {Math.round((st.labelSize ?? 0.15) * 100)}
                      </Label>
                      <Slider
                        value={[st.labelSize ?? 0.15]}
                        min={0.08} max={0.32} step={0.01}
                        onValueChange={([v]) => updateStyle(a, { labelSize: v })}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default AnnotationManager;
