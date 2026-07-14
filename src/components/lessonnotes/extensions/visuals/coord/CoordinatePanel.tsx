// Smart Coordinate Plane — property panel. Three tabs:
// Plane (mode / grid / axes / colours), Object (edit selected component
// or point), Add (menu of components to insert via pick tool).

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  displayName,
  type CoordComponent,
  type CoordMode,
  type CoordPlaneAttrs,
  type CurveKind,
} from "./components";

interface Props {
  open: boolean;
  onClose: () => void;
  attrs: CoordPlaneAttrs;
  onPatch: (p: Partial<CoordPlaneAttrs>) => void;
  onRequestPick: (kind: string, needed: number, curveKind?: string) => void;
  pickMode: unknown;
}

type Tab = "plane" | "object" | "add";

export function CoordinatePanel({ open, onClose, attrs, onPatch, onRequestPick }: Props) {
  const [tab, setTab] = useState<Tab>("plane");
  if (!open) return null;

  const sel = attrs.selectedId
    ? attrs.components.find(c => c.id === attrs.selectedId)
    : null;
  const selPoint = attrs.selectedId && attrs.points[attrs.selectedId] ? attrs.selectedId : null;

  return (
    <div className="absolute top-0 left-full ml-3 z-20 w-72 rounded-lg border bg-background shadow-lg text-sm"
         onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="font-semibold">Coordinate Plane</div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="flex border-b text-xs">
        {(["plane", "object", "add"] as Tab[]).map(t => (
          <button key={t}
            className={`flex-1 py-2 ${tab === t ? "border-b-2 border-primary font-semibold" : "text-muted-foreground"}`}
            onClick={() => setTab(t)}>
            {t === "plane" ? "Plane" : t === "object" ? "Object" : "Add"}
          </button>
        ))}
      </div>

      <div className="p-3 max-h-96 overflow-auto">
        {tab === "plane" && <PlaneTab attrs={attrs} onPatch={onPatch} />}
        {tab === "object" && (
          sel ? <ComponentEditor c={sel} attrs={attrs} onPatch={onPatch} />
              : selPoint ? <PointEditor name={selPoint} attrs={attrs} onPatch={onPatch} />
              : <div className="text-muted-foreground text-xs">Click a point, line or shape on the plane to edit it.</div>
        )}
        {tab === "add" && <AddTab onRequestPick={onRequestPick} />}
      </div>

      {tab === "object" && attrs.components.length > 0 && (
        <div className="border-t p-2 text-xs">
          <div className="text-muted-foreground mb-1">All objects</div>
          <div className="flex flex-col gap-1 max-h-36 overflow-auto">
            {attrs.components.map(c => (
              <div key={c.id} className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer ${attrs.selectedId === c.id ? "bg-primary/10" : "hover:bg-muted"}`}
                   onClick={() => onPatch({ selectedId: c.id })}>
                <span>{displayName(c)}</span>
                <button className="opacity-60 hover:opacity-100" onClick={(e) => {
                  e.stopPropagation();
                  onPatch({ components: attrs.components.filter(x => x.id !== c.id), selectedId: null });
                }}><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plane tab ────────────────────────────────────────────────────────────
function PlaneTab({ attrs, onPatch }: { attrs: CoordPlaneAttrs; onPatch: (p: Partial<CoordPlaneAttrs>) => void }) {
  const modes: { v: CoordMode; label: string }[] = [
    { v: "cartesian4", label: "Cartesian (4 quadrants)" },
    { v: "cartesian1", label: "Cartesian (1st quadrant)" },
    { v: "polar", label: "Polar" },
    { v: "complex", label: "Complex (Argand)" },
    { v: "isometric", label: "Isometric" },
    { v: "dot", label: "Dot grid" },
  ];
  const v = attrs.view; const d = attrs.display;
  return (
    <div className="space-y-3">
      <Row label="Mode">
        <select className="w-full rounded border bg-background px-2 py-1 text-xs"
                value={attrs.mode}
                onChange={(e) => onPatch({ mode: e.target.value as CoordMode })}>
          {modes.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
        </select>
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="x min" value={v.xMin} onChange={(x) => onPatch({ view: { ...v, xMin: x } })} />
        <NumField label="x max" value={v.xMax} onChange={(x) => onPatch({ view: { ...v, xMax: x } })} />
        <NumField label="y min" value={v.yMin} onChange={(x) => onPatch({ view: { ...v, yMin: x } })} />
        <NumField label="y max" value={v.yMax} onChange={(x) => onPatch({ view: { ...v, yMax: x } })} />
        <NumField label="Grid step" value={v.gridStep} onChange={(x) => onPatch({ view: { ...v, gridStep: x || 1 } })} />
      </div>
      <Toggle label="Show grid" value={d.showGrid} onChange={(b) => onPatch({ display: { ...d, showGrid: b } })} />
      <Toggle label="Show axes" value={d.showAxes} onChange={(b) => onPatch({ display: { ...d, showAxes: b } })} />
      <Toggle label="Show numbers" value={d.showNumbers} onChange={(b) => onPatch({ display: { ...d, showNumbers: b } })} />
      <Toggle label="Snap to grid" value={d.snap} onChange={(b) => onPatch({ display: { ...d, snap: b } })} />
      <Toggle label="Equal scale" value={!!v.equalScale} onChange={(b) => onPatch({ view: { ...v, equalScale: b } })} />
    </div>
  );
}

// ── Point editor ─────────────────────────────────────────────────────────
function PointEditor({ name, attrs, onPatch }: { name: string; attrs: CoordPlaneAttrs; onPatch: (p: Partial<CoordPlaneAttrs>) => void }) {
  const p = attrs.points[name];
  const set = (patch: Partial<typeof p>) =>
    onPatch({ points: { ...attrs.points, [name]: { ...p, ...patch } } });
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold">Point {name}</div>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="x" value={p.x} onChange={(v) => set({ x: v })} />
        <NumField label="y" value={p.y} onChange={(v) => set({ y: v })} />
      </div>
      <Toggle label="Hide label" value={!!p.labelHidden} onChange={(b) => set({ labelHidden: b })} />
      <Toggle label="Hidden" value={!!p.hidden} onChange={(b) => set({ hidden: b })} />
      <Toggle label="Locked" value={!!p.locked} onChange={(b) => set({ locked: b })} />
      <button className="w-full rounded border py-1 text-xs text-destructive hover:bg-destructive/10"
        onClick={() => {
          const { [name]: _, ...rest } = attrs.points;
          onPatch({ points: rest, selectedId: null,
            components: attrs.components.filter(c => !c.nodes?.includes(name)) });
        }}>Delete point</button>
    </div>
  );
}

// ── Component editor ─────────────────────────────────────────────────────
function ComponentEditor({ c, attrs, onPatch }: { c: CoordComponent; attrs: CoordPlaneAttrs; onPatch: (p: Partial<CoordPlaneAttrs>) => void }) {
  const set = (patch: Partial<CoordComponent>) =>
    onPatch({ components: attrs.components.map(x => x.id === c.id ? deepMerge(x, patch) : x) });

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold">{displayName(c)}</div>
      <Row label="Label">
        <input className="w-full rounded border bg-background px-2 py-1 text-xs"
          value={c.content?.label ?? ""}
          onChange={(e) => set({ content: { ...c.content, label: e.target.value } })} />
      </Row>
      <Row label="Colour">
        <input type="color" className="h-6 w-full"
          value={c.appearance?.color?.startsWith("#") ? c.appearance!.color! : "#3b82f6"}
          onChange={(e) => set({ appearance: { ...c.appearance, color: e.target.value } })} />
      </Row>
      <Row label="Thickness">
        <input type="range" min={0.5} max={6} step={0.5} className="w-full"
          value={c.appearance?.thickness ?? 2}
          onChange={(e) => set({ appearance: { ...c.appearance, thickness: parseFloat(e.target.value) } })} />
      </Row>
      <Row label="Dash">
        <select className="w-full rounded border bg-background px-2 py-1 text-xs"
          value={c.appearance?.dash ?? "solid"}
          onChange={(e) => set({ appearance: { ...c.appearance, dash: e.target.value as any } })}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </Row>
      {(c.kind === "segment" || c.kind === "line" || c.kind === "ray") && (
        <Row label="Arrow">
          <select className="w-full rounded border bg-background px-2 py-1 text-xs"
            value={c.appearance?.arrow ?? "none"}
            onChange={(e) => set({ appearance: { ...c.appearance, arrow: e.target.value as any } })}>
            <option value="none">None</option>
            <option value="end">End</option>
            <option value="both">Both</option>
          </select>
        </Row>
      )}
      {c.kind === "segment" && (
        <Toggle label="Show length" value={!!c.content?.showLength}
          onChange={(b) => set({ content: { ...c.content, showLength: b } })} />
      )}
      {c.kind === "curve" && (
        <CurveEditor c={c} onSet={set} />
      )}
      <Toggle label="Visible" value={c.behaviour?.visible !== false}
        onChange={(b) => set({ behaviour: { ...c.behaviour, visible: b } })} />
      <div className="flex gap-2">
        <button className="flex-1 rounded border py-1 text-xs hover:bg-muted"
          onClick={() => set({ behaviour: { ...c.behaviour, layer: (c.behaviour?.layer ?? 0) + 1 } })}>Bring forward</button>
        <button className="flex-1 rounded border py-1 text-xs hover:bg-muted"
          onClick={() => set({ behaviour: { ...c.behaviour, layer: (c.behaviour?.layer ?? 0) - 1 } })}>Send back</button>
      </div>
      <button className="w-full rounded border py-1 text-xs text-destructive hover:bg-destructive/10"
        onClick={() => onPatch({ components: attrs.components.filter(x => x.id !== c.id), selectedId: null })}>
        Delete
      </button>
    </div>
  );
}

function CurveEditor({ c, onSet }: { c: CoordComponent; onSet: (p: Partial<CoordComponent>) => void }) {
  const cv = c.curve ?? { kind: "fn" as CurveKind };
  return (
    <div className="space-y-2 rounded border p-2">
      <Row label="Kind">
        <select className="w-full rounded border bg-background px-2 py-1 text-xs"
          value={cv.kind}
          onChange={(e) => onSet({ curve: { ...cv, kind: e.target.value as CurveKind } })}>
          <option value="fn">y = f(x)</option>
          <option value="sine">Sine</option>
          <option value="cosine">Cosine</option>
          <option value="tangent">Tangent</option>
          <option value="parabola">Parabola</option>
          <option value="cubic">Cubic</option>
          <option value="exponential">Exponential</option>
          <option value="log">Logarithm</option>
          <option value="abs">Absolute</option>
          <option value="circleEq">Circle (equation)</option>
        </select>
      </Row>
      {cv.kind === "fn" && (
        <Row label="Expression">
          <input className="w-full rounded border bg-background px-2 py-1 text-xs font-mono"
            value={cv.expr ?? ""} placeholder="x^2 + 1"
            onChange={(e) => onSet({ curve: { ...cv, expr: e.target.value } })} />
        </Row>
      )}
    </div>
  );
}

// ── Add tab ──────────────────────────────────────────────────────────────
function AddTab({ onRequestPick }: { onRequestPick: (kind: string, needed: number, curveKind?: string) => void }) {
  const groups: { title: string; items: { label: string; kind: string; needed: number; curveKind?: string }[] }[] = [
    { title: "Geometry", items: [
      { label: "Point", kind: "point", needed: 1 },
      { label: "Segment", kind: "segment", needed: 2 },
      { label: "Ray", kind: "ray", needed: 2 },
      { label: "Line", kind: "line", needed: 2 },
      { label: "Triangle", kind: "polygon", needed: 3 },
      { label: "Quadrilateral", kind: "polygon", needed: 4 },
      { label: "Circle (centre + radius pt)", kind: "circle", needed: 2 },
      { label: "Arc (centre, start, end)", kind: "arc", needed: 3 },
      { label: "Angle mark (A, V, B)", kind: "angleMark", needed: 3 },
    ]},
    { title: "Vectors", items: [
      { label: "Vector (tail → head)", kind: "vector", needed: 2 },
    ]},
    { title: "Functions", items: [
      { label: "y = f(x)", kind: "curve", needed: 0, curveKind: "fn" },
      { label: "Sine", kind: "curve", needed: 0, curveKind: "sine" },
      { label: "Cosine", kind: "curve", needed: 0, curveKind: "cosine" },
      { label: "Parabola", kind: "curve", needed: 0, curveKind: "parabola" },
      { label: "Cubic", kind: "curve", needed: 0, curveKind: "cubic" },
      { label: "Exponential", kind: "curve", needed: 0, curveKind: "exponential" },
      { label: "Logarithm", kind: "curve", needed: 0, curveKind: "log" },
      { label: "Absolute", kind: "curve", needed: 0, curveKind: "abs" },
    ]},
    { title: "Annotations", items: [
      { label: "Label", kind: "label", needed: 1 },
    ]},
  ];
  return (
    <div className="space-y-3">
      {groups.map(g => (
        <div key={g.title}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{g.title}</div>
          <div className="grid grid-cols-2 gap-1">
            {g.items.map(it => (
              <button key={it.label}
                onClick={() => it.needed === 0
                  ? onRequestPick(it.kind, 0, it.curveKind)  // curves need no picks
                  : onRequestPick(it.kind, it.needed, it.curveKind)}
                className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted text-left">
                <Plus className="h-3 w-3 shrink-0" />
                <span className="truncate">{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="text-[10px] text-muted-foreground">Tip: after clicking an option, tap the plane to place each point.</div>
    </div>
  );
}

// ── shared ───────────────────────────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Row label={label}>
      <input type="number" className="w-full rounded border bg-background px-2 py-1 text-xs"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </Row>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-xs">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function deepMerge<T>(a: T, b: Partial<T>): T {
  const out: any = { ...a };
  for (const k of Object.keys(b) as (keyof T)[]) {
    const av = (a as any)[k]; const bv = (b as any)[k];
    if (av && bv && typeof av === "object" && typeof bv === "object" && !Array.isArray(av))
      out[k] = { ...av, ...bv };
    else out[k] = bv;
  }
  return out;
}
