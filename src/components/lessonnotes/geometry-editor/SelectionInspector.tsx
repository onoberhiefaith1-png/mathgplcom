// SelectionInspector — context-sensitive right-panel editor.
// The visible controls are chosen from `kind` (the click target on canvas)
// so a Point shows only Point props, a Segment body shows the foldable
// line sections, etc.

import { useState } from "react";
import type { GeometryScene, GeoObject, GeoPoint, GeoSegment } from "@/lib/geometry/scene";
import { patchObject } from "@/lib/geometry/editor/sceneOps";
import type { HitKind } from "@/lib/geometry/editor/snap";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  scene: GeometryScene;
  selected: GeoObject[];
  kind?: HitKind | null;
  onApply: (next: GeometryScene) => void;
}

export function SelectionInspector({ scene, selected, kind, onApply }: Props) {
  if (selected.length === 0) {
    return (
      <p className="text-[11px] text-foreground/55">
        Click a point, a point's label, or a line segment to edit its properties here.
      </p>
    );
  }

  const primary = selected[0];
  const effective: HitKind =
    kind ??
    (primary.type === "point" ? "point"
      : primary.type === "segment" ? "segmentBody"
      : (primary.type as HitKind));

  const patch = (id: string, p: Partial<GeoObject>) => onApply(patchObject(scene, id, p).scene);
  const patchAll = (p: Partial<GeoObject>) => {
    let s = scene;
    for (const o of selected) s = patchObject(s, o.id, p).scene;
    onApply(s);
  };

  if (effective === "point" && primary.type === "point") {
    return <PointPanel point={primary} onPatch={(p) => patch(primary.id, p)} />;
  }
  if (effective === "pointLabel" && primary.type === "point") {
    return <PointLabelPanel point={primary} onPatch={(p) => patch(primary.id, p)} />;
  }
  if (effective === "segmentLabel" && primary.type === "segment") {
    return <SegmentLabelPanel segment={primary} onPatch={(p) => patch(primary.id, p)} />;
  }
  if (effective === "segmentDistance" && primary.type === "segment") {
    return <SegmentDistancePanel segment={primary} onPatch={(p) => patch(primary.id, p)} />;
  }
  if (effective === "segmentBody" && primary.type === "segment") {
    return <SegmentBodyPanel segment={primary} onPatchAll={patchAll} count={selected.length} />;
  }

  // Fallback minimal editor for other kinds
  return (
    <div className="text-[11px] text-foreground/60">
      <p className="uppercase tracking-wider mb-1">{primary.type}</p>
      <p>No editable properties yet.</p>
    </div>
  );
}

/* ─────── Point ─────── */
function PointPanel({ point, onPatch }: { point: GeoPoint; onPatch: (p: Partial<GeoPoint>) => void }) {
  return (
    <div className="space-y-2 text-xs">
      <Header>Point {point.label ? `· ${point.label}` : ""}</Header>
      <Row label="Point Colour">
        <input
          type="color"
          value={point.color ?? "#1f1f24"}
          onChange={(e) => onPatch({ color: e.target.value })}
          className="h-6 w-10 rounded border border-foreground/20 bg-white cursor-pointer"
        />
      </Row>
      <Row label="Size">
        <input
          type="range" min={1.5} max={6} step={0.1}
          value={point.size ?? 2.4}
          onChange={(e) => onPatch({ size: Number(e.target.value) })}
          className="w-full"
        />
      </Row>
      <Row label="Label size">
        <div className="flex items-center gap-2 w-full">
          <input
            type="range" min={9} max={28} step={1}
            value={point.labelFontSize ?? 14}
            onChange={(e) => onPatch({ labelFontSize: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="text-[10px] tabular-nums w-6 text-foreground/60">{point.labelFontSize ?? 14}</span>
        </div>
      </Row>
      <Row label="Hide Point">
        <input
          type="checkbox"
          checked={!!point.hidden}
          onChange={(e) => onPatch({ hidden: e.target.checked })}
        />
      </Row>
    </div>
  );
}

/* ─────── Point label ─────── */
function PointLabelPanel({ point, onPatch }: { point: GeoPoint; onPatch: (p: Partial<GeoPoint>) => void }) {
  return (
    <div className="space-y-2 text-xs">
      <Header>Point Label</Header>
      <Row label="Rename">
        <input
          value={point.label ?? ""}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="A"
          className="w-full bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
        />
      </Row>
      <Row label="Size">
        <div className="flex items-center gap-2 w-full">
          <input
            type="range" min={9} max={28} step={1}
            value={point.labelFontSize ?? 14}
            onChange={(e) => onPatch({ labelFontSize: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="text-[10px] tabular-nums w-6 text-foreground/60">{point.labelFontSize ?? 14}</span>
        </div>
      </Row>
      <p className="text-[10px] text-foreground/55">Drag the label on the canvas to move it. The point stays in place.</p>
    </div>
  );
}

/* ─────── Segment name label ─────── */
function SegmentLabelPanel({ segment, onPatch }: { segment: GeoSegment; onPatch: (p: Partial<GeoSegment>) => void }) {
  return (
    <div className="space-y-2 text-xs">
      <Header>Line Label</Header>
      <Row label="Rename">
        <input
          value={segment.label ?? ""}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="AB"
          className="w-full bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
        />
      </Row>
      <p className="text-[10px] text-foreground/55">Drag the label on the canvas to move it around the line.</p>
    </div>
  );
}

/* ─────── Segment distance chip ─────── */
function SegmentDistancePanel({ segment, onPatch }: { segment: GeoSegment; onPatch: (p: Partial<GeoSegment>) => void }) {
  const value = segment.distance ?? segment.length ?? "";
  return (
    <div className="space-y-2 text-xs">
      <Header>Distance</Header>
      <Row label="Text">
        <input
          value={value}
          onChange={(e) => onPatch({ distance: e.target.value, length: undefined } as any)}
          placeholder="5 cm, 2x + 3"
          className="w-full bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
        />
      </Row>
      <button
        type="button"
        onClick={() => onPatch({ distance: undefined, length: undefined, distanceOffset: undefined } as any)}
        className="text-[11px] text-destructive underline"
      >
        Remove distance
      </button>
    </div>
  );
}

/* ─────── Segment body ─────── */
function SegmentBodyPanel({
  segment, onPatchAll, count,
}: { segment: GeoSegment; onPatchAll: (p: Partial<GeoSegment>) => void; count: number }) {
  const dashedMode: "solid" | "dotted" | "dashed" =
    segment.dashed === true ? "dashed" : segment.dashed === "dotted" ? "dotted" : "solid";
  const arrow = segment.arrow ?? "none";
  const eq = segment.marks === "tick" ? 1
    : segment.marks === "double" ? 2
    : segment.marks === "triple" ? 3
    : segment.marks === "quadruple" ? 4
    : 0;
  const par = segment.parallelMarks ?? 0;
  const hasDist = !!(segment.distance ?? segment.length);

  return (
    <div className="space-y-2 text-xs">
      <Header>Segment {count > 1 ? `· ${count} selected` : segment.label ? `· ${segment.label}` : ""}</Header>

      <Fold title="Basic Line" defaultOpen>
        <Radios
          value={dashedMode}
          onChange={(v) => onPatchAll({ dashed: v === "solid" ? false : v === "dotted" ? "dotted" : true } as any)}
          options={[["solid", "Solid"], ["dotted", "Dotted"], ["dashed", "Dashed"]]}
        />
      </Fold>

      <Fold title="Arrow">
        <Radios
          value={arrow}
          onChange={(v) => onPatchAll({ arrow: v as any })}
          options={[["none", "None"], ["start", "At start"], ["end", "At end"], ["both", "Both ends"]]}
        />
      </Fold>

      <Fold title="Equality Marks">
        <Radios
          value={String(eq)}
          onChange={(v) => {
            const n = Number(v);
            const marks = n === 0 ? null : n === 1 ? "tick" : n === 2 ? "double" : n === 3 ? "triple" : "quadruple";
            onPatchAll({ marks: marks as any });
          }}
          options={[["0", "None"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]]}
        />
      </Fold>

      <Fold title="Parallel Marks">
        <Radios
          value={String(par)}
          onChange={(v) => onPatchAll({ parallelMarks: Number(v) as any })}
          options={[["0", "None"], ["1", "1"], ["2", "2"], ["3", "3"]]}
        />
      </Fold>

      <Fold title="Distance">
        {hasDist ? (
          <div className="space-y-1">
            <input
              value={segment.distance ?? segment.length ?? ""}
              onChange={(e) => onPatchAll({ distance: e.target.value, length: undefined } as any)}
              placeholder="5 cm, 2x + 3"
              className="w-full bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => onPatchAll({ distance: undefined, length: undefined, distanceOffset: undefined } as any)}
              className="text-[11px] text-destructive underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onPatchAll({ distance: "" } as any)}
            className="text-[11px] px-2 py-1 rounded border border-foreground/20 bg-background hover:bg-muted"
          >
            + Add distance
          </button>
        )}
      </Fold>

      <Row label="Line Colour">
        <input
          type="color"
          value={segment.color ?? "#1f1f24"}
          onChange={(e) => onPatchAll({ color: e.target.value } as any)}
          className="h-6 w-10 rounded border border-foreground/20 bg-white cursor-pointer"
        />
      </Row>
    </div>
  );
}

/* ─────── UI atoms ─────── */
function Header({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-wider text-foreground/55">{children}</p>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[92px_1fr] items-center gap-2">
      <span className="text-[11px] text-foreground/70">{label}</span>
      <span>{children}</span>
    </label>
  );
}

function Fold({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded border border-foreground/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-medium hover:bg-muted/40"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="px-2 py-1.5">{children}</div>}
    </div>
  );
}

function Radios({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-2 py-0.5 rounded border text-[11px] ${
            value === v
              ? "bg-primary text-primary-foreground border-primary"
              : "border-foreground/20 bg-background hover:bg-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
