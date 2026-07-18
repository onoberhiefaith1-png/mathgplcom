// SelectionInspector — context-sensitive right-panel editor.
// The visible controls are chosen from `kind` (the click target on canvas)
// so a Point shows only Point props, a Segment body shows the foldable
// line sections, etc.

import { useState, useMemo } from "react";
import type { GeometryScene, GeoObject, GeoPoint, GeoSegment, GeoAngle, GeoRegion, GeoLabel, GeoId } from "@/lib/geometry/scene";
import { pointById } from "@/lib/geometry/scene";
import { patchObject, addAngle, addFloatingLabel } from "@/lib/geometry/editor/sceneOps";
import { cycleFromSegments } from "@/lib/geometry/editor/regions";
import type { HitKind } from "@/lib/geometry/editor/snap";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";

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

  // ─── Multi-selection routing ─────────────────────────────────────────
  if (selected.length >= 2) {
    return <MultiPanel scene={scene} selected={selected} onApply={onApply} />;
  }

  const primary = selected[0];
  const effective: HitKind =
    kind ??
    (primary.type === "point" ? "point"
      : primary.type === "segment" ? "segmentBody"
      : (primary.type as HitKind));

  const patch = (id: string, p: Partial<GeoObject>) => onApply(patchObject(scene, id, p).scene);

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
    return <SegmentBodyPanel segment={primary} onPatchAll={(p) => patch(primary.id, p)} count={1} title={`Segment · ${primary.label ?? labelForSegment(scene, primary)}`} />;
  }
  if (effective === "angleValue" && primary.type === "angle") {
    return <AngleValueTextPanel angle={primary} onPatch={(p) => patch(primary.id, p)} />;
  }
  if (primary.type === "angle") {
    return <AngleEditPanel scene={scene} angle={primary} onApply={onApply} />;
  }
  if (primary.type === "region") {
    return <RegionPanel scene={scene} region={primary} onApply={onApply} />;
  }
  if (primary.type === "label") {
    return <LabelPanel label={primary} onPatch={(p) => patch(primary.id, p)} onDelete={() => onApply({ ...scene, objects: scene.objects.filter((o) => o.id !== primary.id) })} />;
  }

  if (primary.type === "circle" || primary.type === "arc" || primary.type === "curve") {
    return <FillablePanel obj={primary as any} onPatch={(p) => patch(primary.id, p as any)} onAddText={() => onApply(addFloatingLabelAtShape(scene, primary))} />;
  }

  // Fallback minimal editor for other kinds
  return (
    <div className="text-[11px] text-foreground/60">
      <p className="uppercase tracking-wider mb-1">{primary.type}</p>
      <p>No editable properties yet.</p>
    </div>
  );
}

function FillablePanel({ obj, onPatch, onAddText }: { obj: { id: string; type: string; fill?: string; fillOpacity?: number; dashed?: boolean }; onPatch: (p: Partial<{ fill: string; fillOpacity: number; dashed: boolean }>) => void; onAddText?: () => void }) {
  const [enabled, setEnabled] = useState<boolean>(!!obj.fill);
  const [color, setColor] = useState<string>(obj.fill ?? "#3b82f6");
  const [opacity, setOpacity] = useState<number>(obj.fillOpacity ?? 0.2);
  return (
    <div className="space-y-2 text-xs">
      <p className="uppercase tracking-wider text-[11px] font-semibold text-foreground/70">{obj.type.toUpperCase()}</p>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => {
          const on = e.target.checked;
          setEnabled(on);
          onPatch(on ? { fill: color, fillOpacity: opacity } : { fill: undefined as any });
        }} />
        <span>Shade enclosed area</span>
      </label>
      {enabled && (
        <div className="space-y-2 pl-1">
          <div className="flex items-center gap-2">
            <label className="text-[11px] w-14 text-foreground/70">Color</label>
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); onPatch({ fill: e.target.value }); }} className="h-7 w-10 rounded border border-foreground/20 bg-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] w-14 text-foreground/70">Opacity</label>
            <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => { const v = Number(e.target.value); setOpacity(v); onPatch({ fillOpacity: v }); }} className="flex-1" />
            <span className="text-[10px] text-foreground/60 w-8 text-right">{Math.round(opacity * 100)}%</span>
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!obj.dashed} onChange={(e) => onPatch({ dashed: e.target.checked })} />
        <span>Dashed</span>
      </label>
      {onAddText && (
        <button
          type="button"
          onClick={onAddText}
          className="w-full text-[11px] px-2 py-1 rounded border border-foreground/20 bg-background hover:bg-muted"
        >
          + Add text
        </button>
      )}
    </div>
  );
}

/* ─────── Floating label (universal text) ─────── */
function LabelPanel({ label, onPatch, onDelete }: { label: GeoLabel; onPatch: (p: Partial<GeoLabel>) => void; onDelete: () => void }) {
  return (
    <div className="space-y-2 text-xs">
      <Header>Text</Header>
      <Row label="Text">
        <input
          value={label.text}
          onChange={(e) => onPatch({ text: e.target.value })}
          placeholder="Landmark"
          className="w-full bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
        />
      </Row>
      <Row label="Size">
        <div className="flex items-center gap-2 w-full">
          <input
            type="range" min={9} max={40} step={1}
            value={label.fontSize ?? 13}
            onChange={(e) => onPatch({ fontSize: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="text-[10px] tabular-nums w-6 text-foreground/60">{label.fontSize ?? 13}</span>
        </div>
      </Row>
      <Row label="Colour">
        <input
          type="color"
          value={label.color ?? "#1f1f24"}
          onChange={(e) => onPatch({ color: e.target.value })}
          className="h-6 w-10 rounded border border-foreground/20 bg-white cursor-pointer"
        />
      </Row>
      <Row label="Rotate">
        <div className="flex items-center gap-2 w-full">
          <input
            type="range" min={-180} max={180} step={5}
            value={label.rotation ?? 0}
            onChange={(e) => onPatch({ rotation: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="text-[10px] tabular-nums w-8 text-foreground/60">{label.rotation ?? 0}°</span>
        </div>
      </Row>
      <p className="text-[10px] text-foreground/55">Drag the text on the canvas to move it anywhere.</p>
      <button type="button" onClick={onDelete} className="text-[11px] text-destructive underline">Remove text</button>
    </div>
  );
}

/** Helper: drop a floating label somewhere sensible for a shape. */
function addFloatingLabelAtShape(scene: GeometryScene, obj: GeoObject): GeometryScene {
  let x = 20, y = 20;
  if (obj.type === "circle" || obj.type === "arc") {
    const c = pointById(scene, obj.center);
    if (c) { x = c.x; y = c.y; }
  } else if (obj.type === "curve") {
    const anchors = obj.a && obj.mid && obj.b
      ? [obj.a, obj.mid, obj.b]
      : (obj.points ?? []);
    const mids = anchors.map((id) => pointById(scene, id)).filter(Boolean) as GeoPoint[];
    if (mids.length) {
      x = mids.reduce((a, p) => a + p.x, 0) / mids.length;
      y = mids.reduce((a, p) => a + p.y, 0) / mids.length;
    }
  } else if (obj.type === "segment") {
    const a = pointById(scene, obj.a); const b = pointById(scene, obj.b);
    if (a && b) { x = (a.x + b.x) / 2; y = (a.y + b.y) / 2 - 14; }
  } else if (obj.type === "region") {
    const pts = obj.boundary.map((id) => pointById(scene, id)).filter(Boolean) as GeoPoint[];
    if (pts.length) {
      x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    }
  }
  return addFloatingLabel(scene, x, y, "Text").scene;
}




/* ─────── Multi-selection ─────── */
function MultiPanel({ scene, selected, onApply }: { scene: GeometryScene; selected: GeoObject[]; onApply: (s: GeometryScene) => void }) {
  const segments = selected.filter((o): o is GeoSegment => o.type === "segment");
  const points = selected.filter((o): o is GeoPoint => o.type === "point");
  const title = titleFor(scene, selected);

  // Try to detect a closed cycle from the selected segments for region shading.
  const region = useMemo(() => cycleFromSegments(scene, segments.map((s) => s.id)), [scene, segments]);

  // Look for an existing angle that matches the current selection (a segment
  // pair or a point triple), so re-clicking those items reveals its editor.
  const existingAngle = useMemo<GeoAngle | null>(() => {
    if (segments.length === 2) {
      const shared = sharedEndpoint(segments[0], segments[1]);
      if (!shared) return null;
      const armA = segments[0].a === shared ? segments[0].b : segments[0].a;
      const armB = segments[1].a === shared ? segments[1].b : segments[1].a;
      return (
        scene.objects.find(
          (o): o is GeoAngle =>
            o.type === "angle" &&
            o.vertex === shared &&
            ((o.a === armA && o.b === armB) || (o.a === armB && o.b === armA)),
        ) ?? null
      );
    }
    return null;
  }, [scene, segments]);

  return (
    <div className="space-y-2 text-xs">
      <Header>{title}</Header>

      {segments.length >= 2 && (
        <AngleFromSegmentsPanel
          scene={scene}
          segments={segments}
          existing={existingAngle}
          onApply={onApply}
        />
      )}

      {points.length >= 2 && segments.length === 0 && (
        <AngleFromPointsPanel scene={scene} points={points} onApply={onApply} />
      )}

      {region && (
        <RegionCreatePanel scene={scene} boundary={region.boundary} onApply={onApply} />
      )}

      {segments.length >= 2 && !existingAngle && (
        <div className="rounded border border-foreground/10 p-2 text-[10px] text-foreground/55">
          Shared style controls apply to all {segments.length} segments.
        </div>
      )}
      {segments.length >= 2 && (
        <SegmentBodyPanel
          segment={segments[0]}
          onPatchAll={(p) => {
            let s = scene;
            for (const seg of segments) s = patchObject(s, seg.id, p).scene;
            onApply(s);
          }}
          count={segments.length}
          title={`${segments.length} segments`}
        />
      )}
    </div>
  );
}

function labelForSegment(scene: GeometryScene, s: GeoSegment): string {
  const a = scene.objects.find((o) => o.id === s.a) as GeoPoint | undefined;
  const b = scene.objects.find((o) => o.id === s.b) as GeoPoint | undefined;
  return `${a?.label ?? s.a}${b?.label ?? s.b}`;
}

function titleFor(scene: GeometryScene, sel: GeoObject[]): string {
  if (sel.length === 1) {
    const o = sel[0];
    if (o.type === "point") return `POINT · ${o.label ?? o.id}`;
    if (o.type === "segment") return `LINE · ${labelForSegment(scene, o)}`;
    return o.type.toUpperCase();
  }
  const segs = sel.filter((o) => o.type === "segment") as GeoSegment[];
  const pts = sel.filter((o) => o.type === "point") as GeoPoint[];
  if (segs.length === sel.length) {
    return `${segs.length} SEGMENTS · ${segs.map((s) => labelForSegment(scene, s)).join(", ")}`;
  }
  if (pts.length === sel.length) {
    return `${pts.length} POINTS · ${pts.map((p) => p.label ?? p.id).join(", ")}`;
  }
  return `SELECTION · ${sel.length} items`;
}

function sharedEndpoint(a: GeoSegment, b: GeoSegment): GeoId | null {
  if (a.a === b.a || a.a === b.b) return a.a;
  if (a.b === b.a || a.b === b.b) return a.b;
  return null;
}

/* ─────── Angle (from 2 segments) ─────── */
function AngleFromSegmentsPanel({
  scene, segments, existing, onApply,
}: {
  scene: GeometryScene;
  segments: GeoSegment[];
  existing: GeoAngle | null;
  onApply: (s: GeometryScene) => void;
}) {
  const shared = sharedEndpoint(segments[0], segments[1]);
  if (!shared) {
    return (
      <div className="rounded border border-foreground/10 p-2 text-[10px] text-foreground/55">
        These two segments do not share a point, so no angle vertex exists.
      </div>
    );
  }
  const [value, setValue] = useState<string>(existing?.value ?? "");
  const armA = segments[0].a === shared ? segments[0].b : segments[0].a;
  const armB = segments[1].a === shared ? segments[1].b : segments[1].a;

  const commit = (patch: Partial<GeoAngle>) => {
    if (existing) {
      onApply(patchObject(scene, existing.id, patch as any).scene);
    } else {
      const withText = value.trim().length > 0
        ? (value.match(/^-?\d+(\.\d+)?$/) ? `${value}°` : value)
        : undefined;
      const op = addAngle(scene, shared, armA, armB, withText);
      // Apply any additional patch (e.g. reflex) immediately after creating.
      let s = op.scene;
      const id = op.addedIds[0];
      if (Object.keys(patch).length) s = patchObject(s, id, patch as any).scene;
      onApply(s);
    }
  };

  const flip = (dir: "up" | "down") => {
    // Up = go to the opposite (reflex) side. Down = come back to internal.
    commit({ reflex: dir === "up" });
  };

  return (
    <div className="rounded border border-foreground/10 p-2 space-y-2">
      <Header>Angle at vertex</Header>
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const text = value.trim();
            const rendered = text.length === 0 ? undefined
              : text.match(/^-?\d+(\.\d+)?$/) ? `${text}°` : text;
            commit({ value: rendered });
          }}
          placeholder="30, 180, x + 40 …"
          className="flex-1 bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
        />
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => flip("up")}
            title="Flip to opposite side"
            className={`px-1.5 py-0.5 rounded-t border text-[10px] ${
              existing?.reflex ? "bg-primary text-primary-foreground border-primary" : "border-foreground/20 bg-background hover:bg-muted"
            }`}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => flip("down")}
            title="Bring to inside"
            className={`px-1.5 py-0.5 rounded-b border-x border-b text-[10px] ${
              !existing?.reflex && existing ? "bg-primary text-primary-foreground border-primary" : "border-foreground/20 bg-background hover:bg-muted"
            }`}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
      {existing && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-foreground/70">Marker</span>
          <div className="flex gap-1">
            {(["arc", "double", "right"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => commit({ marker: m })}
                className={`px-2 py-0.5 rounded border text-[11px] ${
                  existing.marker === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-foreground/20 bg-background hover:bg-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
      {!existing && (
        <p className="text-[10px] text-foreground/55">
          Type a value or press ▲/▼ to insert the angle at this vertex.
        </p>
      )}
    </div>
  );
}

/* ─────── Angle (from selected points) ─────── */
function AngleFromPointsPanel({
  scene, points, onApply,
}: { scene: GeometryScene; points: GeoPoint[]; onApply: (s: GeometryScene) => void }) {
  const [vertex, setVertex] = useState<GeoId>(points[1]?.id ?? points[0].id);
  const [value, setValue] = useState("");
  if (points.length < 3) {
    return (
      <div className="rounded border border-foreground/10 p-2 text-[10px] text-foreground/55">
        Select one more point to define an angle (3 points: arm, vertex, arm).
      </div>
    );
  }
  const others = points.filter((p) => p.id !== vertex);
  const commit = () => {
    if (others.length < 2) return;
    const text = value.trim();
    const rendered = text.length === 0 ? undefined
      : text.match(/^-?\d+(\.\d+)?$/) ? `${text}°` : text;
    const op = addAngle(scene, vertex, others[0].id, others[1].id, rendered);
    onApply(op.scene);
  };
  return (
    <div className="rounded border border-foreground/10 p-2 space-y-2">
      <Header>Angle from points</Header>
      <label className="grid grid-cols-[64px_1fr] items-center gap-2 text-[11px]">
        <span className="text-foreground/70">Vertex</span>
        <select
          value={vertex}
          onChange={(e) => setVertex(e.target.value)}
          className="bg-white text-black border border-foreground/20 rounded px-1 py-0.5"
        >
          {points.map((p) => (
            <option key={p.id} value={p.id}>{p.label ?? p.id}</option>
          ))}
        </select>
      </label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="30, 180, x + 40 …"
        className="w-full bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={commit}
        className="text-[11px] px-2 py-1 rounded border border-foreground/20 bg-background hover:bg-muted"
      >
        Insert angle
      </button>
    </div>
  );
}

/* ─────── Angle (existing single-select) ─────── */
function AngleEditPanel({ scene, angle, onApply }: { scene: GeometryScene; angle: GeoAngle; onApply: (s: GeometryScene) => void }) {
  const [value, setValue] = useState(angle.value ?? "");
  const patch = (p: Partial<GeoAngle>) => onApply(patchObject(scene, angle.id, p as any).scene);
  return (
    <div className="space-y-2 text-xs">
      <Header>Angle</Header>
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const text = value.trim();
            const rendered = text.length === 0 ? undefined
              : text.match(/^-?\d+(\.\d+)?$/) ? `${text}°` : text;
            patch({ value: rendered });
          }}
          placeholder="30, 180, x + 40 …"
          className="flex-1 bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
        />
        <div className="flex flex-col">
          <button type="button" onClick={() => patch({ reflex: true })}
            className={`px-1.5 py-0.5 rounded-t border text-[10px] ${angle.reflex ? "bg-primary text-primary-foreground border-primary" : "border-foreground/20 bg-background hover:bg-muted"}`}>
            <ChevronUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => patch({ reflex: false })}
            className={`px-1.5 py-0.5 rounded-b border-x border-b text-[10px] ${!angle.reflex ? "bg-primary text-primary-foreground border-primary" : "border-foreground/20 bg-background hover:bg-muted"}`}>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────── Region create / edit ─────── */
function RegionCreatePanel({
  scene, boundary, onApply,
}: { scene: GeometryScene; boundary: GeoId[]; onApply: (s: GeometryScene) => void }) {
  const existing = scene.objects.find(
    (o): o is GeoRegion =>
      o.type === "region" &&
      o.boundary.length === boundary.length &&
      o.boundary.every((id) => boundary.includes(id)),
  );
  const [fill, setFill] = useState(existing?.fill ?? "#2563eb");
  const [opacity, setOpacity] = useState(existing?.opacity ?? 0.2);

  const upsert = (patch: Partial<GeoRegion>) => {
    if (existing) {
      onApply(patchObject(scene, existing.id, patch as any).scene);
      return;
    }
    const id = `rg${scene.objects.length + 1}`;
    const region: GeoRegion = { id, type: "region", boundary, fill, opacity, ...patch };
    onApply({ ...scene, objects: [...scene.objects, region] });
  };

  return (
    <div className="rounded border border-foreground/10 p-2 space-y-2">
      <Header>Area / Fill (enclosed)</Header>
      <label className="grid grid-cols-[64px_1fr] items-center gap-2 text-[11px]">
        <span className="text-foreground/70">Colour</span>
        <input
          type="color" value={fill}
          onChange={(e) => { setFill(e.target.value); upsert({ fill: e.target.value }); }}
          className="h-6 w-10 rounded border border-foreground/20 bg-white cursor-pointer"
        />
      </label>
      <label className="grid grid-cols-[64px_1fr] items-center gap-2 text-[11px]">
        <span className="text-foreground/70">Opacity</span>
        <input
          type="range" min={0.05} max={0.9} step={0.05}
          value={opacity}
          onChange={(e) => { const v = Number(e.target.value); setOpacity(v); upsert({ opacity: v }); }}
        />
      </label>
      {existing && (
        <button
          type="button"
          onClick={() => onApply({ ...scene, objects: scene.objects.filter((o) => o.id !== existing.id) })}
          className="text-[11px] text-destructive underline"
        >
          Remove fill
        </button>
      )}
    </div>
  );
}

function RegionPanel({ scene, region, onApply }: { scene: GeometryScene; region: GeoRegion; onApply: (s: GeometryScene) => void }) {
  return (
    <RegionCreatePanel scene={scene} boundary={region.boundary} onApply={onApply} />
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
      <Header>Distance {value ? `· ${value}` : ""}</Header>
      <Row label="Text">
        <input
          value={value}
          onChange={(e) => onPatch({ distance: e.target.value, length: undefined } as any)}
          placeholder="5 cm, 2x + 3"
          className="w-full bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
        />
      </Row>
      <Row label="Size">
        <div className="flex items-center gap-2 w-full">
          <input
            type="range" min={9} max={28} step={1}
            value={segment.distanceFontSize ?? 12}
            onChange={(e) => onPatch({ distanceFontSize: Number(e.target.value) } as any)}
            className="flex-1"
          />
          <span className="text-[10px] tabular-nums w-6 text-foreground/60">{segment.distanceFontSize ?? 12}</span>
        </div>
      </Row>
      <Row label="Colour">
        <input
          type="color"
          value={segment.distanceColor ?? segment.color ?? "#1f1f24"}
          onChange={(e) => onPatch({ distanceColor: e.target.value } as any)}
          className="h-6 w-10 rounded border border-foreground/20 bg-white cursor-pointer"
        />
      </Row>
      <p className="text-[10px] text-foreground/55">Drag on the canvas to reposition.</p>
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

/* ─────── Angle value chip (clicking "46°") ─────── */
function AngleValueTextPanel({ angle, onPatch }: { angle: GeoAngle; onPatch: (p: Partial<GeoAngle>) => void }) {
  return (
    <div className="space-y-2 text-xs">
      <Header>Angle Value {angle.value ? `· ${angle.value}` : ""}</Header>
      <Row label="Text">
        <input
          value={angle.value ?? ""}
          onChange={(e) => onPatch({ value: e.target.value })}
          placeholder="30°, 180°, x + 40"
          className="w-full bg-white text-black border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
        />
      </Row>
      <Row label="Size">
        <div className="flex items-center gap-2 w-full">
          <input
            type="range" min={9} max={28} step={1}
            value={angle.valueFontSize ?? 12}
            onChange={(e) => onPatch({ valueFontSize: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="text-[10px] tabular-nums w-6 text-foreground/60">{angle.valueFontSize ?? 12}</span>
        </div>
      </Row>
      <Row label="Colour">
        <input
          type="color"
          value={angle.valueColor ?? "#1f1f24"}
          onChange={(e) => onPatch({ valueColor: e.target.value })}
          className="h-6 w-10 rounded border border-foreground/20 bg-white cursor-pointer"
        />
      </Row>
      <p className="text-[10px] text-foreground/55">Drag the value on the canvas to reposition. Use the arc panel to flip sides.</p>
    </div>
  );
}

/* ─────── Segment body ─────── */
function SegmentBodyPanel({
  segment, onPatchAll, count, title,
}: { segment: GeoSegment; onPatchAll: (p: Partial<GeoSegment>) => void; count: number; title?: string }) {
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
      <Header>{title ?? `Segment${count > 1 ? ` · ${count} selected` : segment.label ? ` · ${segment.label}` : ""}`}</Header>

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
