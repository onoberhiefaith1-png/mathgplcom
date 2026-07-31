// Inspector for the selected 3D object: display mode, exact numeric
// transforms and the shape's own mathematical parameters.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, CopyPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOLID_DEFS, type DisplayMode, type Solid3D, type Vec3 } from "@/lib/geometry3d/scene3d";
import { DISPLAY_SCALE_PRESETS, displayScaleOf } from "@/lib/geometry3d/displayScale";

interface Props {
  solid: Solid3D;
  onChange: (patch: Partial<Solid3D>) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

const DEG = 180 / Math.PI;

function NumberRow({
  label, values, step, onChange, suffix,
}: {
  label: string;
  values: Vec3;
  step: number;
  suffix?: string;
  onChange: (next: Vec3) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}{suffix ? ` (${suffix})` : ""}
      </Label>
      <div className="grid grid-cols-3 gap-1.5">
        {values.map((v, i) => (
          <Input
            key={i}
            type="number"
            step={step}
            value={Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0}
            onChange={(e) => {
              const n = Number(e.target.value);
              const next = [...values] as Vec3;
              next[i] = Number.isFinite(n) ? n : 0;
              onChange(next);
            }}
            className="h-7 px-1.5 text-xs"
            aria-label={`${label} ${"XYZ"[i]}`}
          />
        ))}
      </div>
    </div>
  );
}

export function ObjectInspector({ solid, onChange, onDuplicate, onCopy, onDelete }: Props) {
  const def = SOLID_DEFS[solid.kind];
  const display: DisplayMode = solid.style?.display === "solid" ? "solid" : "wireframe";
  const params = solid.params ?? def.params;

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div>
        <p className="text-sm font-semibold">{def.label}</p>
        <p className="text-[11px] text-muted-foreground">Selected object</p>
      </div>

      <div>
        <Label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted-foreground">Display</Label>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["wireframe", "solid"] as DisplayMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ style: { ...solid.style, display: m } })}
              className={cn(
                "rounded px-2.5 py-1 text-xs capitalize transition",
                display === m ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <NumberRow
        label="Position" values={solid.position} step={0.1}
        onChange={(position) => onChange({ position })}
      />
      <NumberRow
        label="Rotation" values={solid.rotation.map((r) => Math.round(r * DEG)) as Vec3} step={5} suffix="°"
        onChange={(deg) => onChange({ rotation: deg.map((d) => d / DEG) as Vec3 })}
      />
      <NumberRow
        label="Scale" values={solid.scale} step={0.1}
        onChange={(scale) => onChange({ scale })}
      />

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Display scale — {Math.round(displayScaleOf(solid) * 100)}%
        </Label>
        <input
          type="range" min={0.25} max={2} step={0.05}
          value={displayScaleOf(solid)}
          onChange={(e) => onChange({ display: { scale: Number(e.target.value) } })}
          className="w-full accent-primary"
          aria-label="Display scale"
        />
        <div className="flex gap-1">
          {DISPLAY_SCALE_PRESETS.map((v) => (
            <button
              key={v} type="button"
              onClick={() => onChange({ display: { scale: v } })}
              className={cn("flex-1 rounded px-1 py-0.5 text-[10px] transition",
                Math.abs(displayScaleOf(solid) - v) < 0.001 ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}
            >{Math.round(v * 100)}%</button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Visual size only — it never changes the mathematics.
        </p>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Mathematical dimensions</Label>
        {def.fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <Input
              type="number"
              min={f.min} max={f.max} step={f.step}
              value={Math.round((params[f.key] ?? 0) * 1000) / 1000}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                onChange({ params: { ...params, [f.key]: Math.min(f.max, Math.max(f.min, n)) } });
              }}
              className="h-7 w-20 px-1.5 text-xs"
              aria-label={f.label}
            />
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onDuplicate}>
          <CopyPlus className="h-3.5 w-3.5" /> Duplicate
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}

export default ObjectInspector;
