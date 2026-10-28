// The universal Smart Geometry Editor panel. Slides in from the right.
// Contains four collapsible sections: Rotate, Expand, Adjust, Add Component.
// The shell is identical for every diagram; adapter methods drive contents.
//
// Works with two adapter tiers:
//   - Geometric adapters (nodes + setMeasure) — reshape by moving vertices.
//   - Attribute adapters (attrs + setAttrs) — reshape by writing tiptap
//     node attrs (used for grids, number lines, charts, tables, …).
// Both adapters may coexist for a shape variant; the panel merges their
// fields into one Adjust list.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Adapter } from "./shapes";
import type { AttrsAdapter } from "./attrsAdapters";
import type { PickTool } from "./LivingCanvas";
import { dist, angleAt, formatLen } from "./geometry";
import type { Nodes, Point } from "./geometry";
import {
  DEFAULT_VISIBILITY, newComponentId,
  type ComponentDef, type ComponentGroup, type Field,
  type LiveComponent, type Visibility, type VisibilityKey,
} from "./schema";
import type { Component } from "./panel/componentModel";
import { displayName, newComponentId as newPartId } from "./panel/componentModel";

interface Props {
  open: boolean;
  onClose: () => void;
  adapter: Adapter | null;
  attrsAdapter: AttrsAdapter;
  attrs: Record<string, unknown>;
  nodes: Nodes | null;
  nodeLabels: Record<string, string>;
  visibility: Visibility;
  viewScale: number;
  components: LiveComponent[];
  onPatch: (patch: {
    nodes?: Nodes;
    nodeLabels?: Record<string, string>;
    visibility?: Visibility;
    viewScale?: number;
    components?: LiveComponent[];
  } & Record<string, unknown>) => void;
  /** When true, render inline (no portal, no header) — used inside PropertyPanel. */
  embedded?: boolean;
  /** Decomposed component parts (sides / angles / vertices / added). */
  parts?: Component[];
  onSelectComponent?: (id: string | null) => void;
  onPatchParts?: (parts: Component[]) => void;
  pickMode?: PickTool | null;
  onRequestPick?: (tool: PickTool | null) => void;
}

const ALL_SECTIONS = ["Rotate", "Expand", "Adjust", "Add Component"] as const;
type Section = typeof ALL_SECTIONS[number];

export function SmartGeometryEditor({
  open, onClose, adapter, attrsAdapter, attrs, nodes, nodeLabels, visibility,
  viewScale, components, onPatch, embedded = false,
  parts = [], onSelectComponent, onPatchParts,
  pickMode = null, onRequestPick,
}: Props) {
  // Rotate hidden when there are no vertices to rotate.
  const hideRotate = !adapter || attrsAdapter.hideRotate === true;
  // Add-Component hidden only when neither adapter offers a menu.
  const hasGeoMenu = (adapter?.componentMenu?.() ?? []).length > 0;
  const hasAttrMenu = (attrsAdapter.componentMenu?.() ?? []).length > 0;
  const hideAddComponent = !hasGeoMenu && !hasAttrMenu;

  const sections: Section[] = ALL_SECTIONS.filter(s =>
    (s !== "Rotate" || !hideRotate) &&
    (s !== "Add Component" || !hideAddComponent),
  );

  const [openSection, setOpenSection] = useState<Section>("Adjust");

  useEffect(() => {
    if (!open || embedded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, embedded, onClose]);

  if (!open || typeof document === "undefined") return null;

  const body = (
    <div className="flex-1 overflow-y-auto text-xs">
      {sections.map((s) => (
        <SectionShell key={s} title={s} open={openSection === s}
          onToggle={() => setOpenSection(openSection === s ? ("" as Section) : s)}>
          {s === "Rotate" && adapter && nodes && (
            <RotateSection nodes={nodes} onPatch={(n) => onPatch({ nodes: n })} />
          )}
          {s === "Expand" && (
            <ExpandSection viewScale={viewScale} onPatch={(v) => onPatch({ viewScale: v })} />
          )}
          {s === "Adjust" && (
            <AdjustSection
              adapter={adapter}
              attrsAdapter={attrsAdapter}
              attrs={attrs}
              nodes={nodes}
              nodeLabels={nodeLabels}
              visibility={visibility}
              onPatch={onPatch}
              parts={parts}
              onSelectComponent={onSelectComponent}
              onPatchParts={onPatchParts}
              pickMode={pickMode}
              onRequestPick={onRequestPick}
            />
          )}
          {s === "Add Component" && (
            <AddComponentSection
              adapter={adapter}
              attrsAdapter={attrsAdapter}
              nodes={nodes}
              nodeLabels={nodeLabels}
              components={components}
              onChange={(c) => onPatch({ components: c })}
            />
          )}
        </SectionShell>
      ))}
    </div>
  );

  if (embedded) return body;

  return createPortal(
    <div
      className="fixed inset-y-0 right-0 z-50 w-[340px] shadow-2xl border-l border-border overflow-hidden flex flex-col"
      style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Smart Geometry Editor</h2>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >Close ✕</button>
      </header>
      {body}
    </div>,
    document.body,
  );
}

// ── section shell ──────────────────────────────────────────────────────
function SectionShell({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 text-left"
      >
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// ── Rotate ─────────────────────────────────────────────────────────────
function RotateSection({ nodes, onPatch }: { nodes: Nodes; onPatch: (n: Nodes) => void }) {
  const [deg, setDeg] = useState("");
  const centre = useMemo(() => centroid(nodes), [nodes]);
  const doRotate = (angle: number) => onPatch(rotateNodes(nodes, centre, angle));
  const doFlip = (axis: "x" | "y") => onPatch(flipNodes(nodes, centre, axis));

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-panel" onClick={() => doRotate(-90)}>↺ Left 90°</button>
        <button className="btn-panel" onClick={() => doRotate(90)}>↻ Right 90°</button>
        <button className="btn-panel" onClick={() => doFlip("y")}>↕ Flip vertical</button>
        <button className="btn-panel" onClick={() => doFlip("x")}>↔ Flip horizontal</button>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="number" placeholder="Angle°"
          value={deg} onChange={(e) => setDeg(e.target.value)}
          className="input-panel flex-1"
        />
        <button
          className="btn-panel"
          onClick={() => { const v = Number(deg); if (Number.isFinite(v)) doRotate(v); }}
        >Rotate</button>
      </div>
    </>
  );
}

// ── Expand ─────────────────────────────────────────────────────────────
function ExpandSection({ viewScale, onPatch }: { viewScale: number; onPatch: (v: number) => void }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <button className="btn-panel" onClick={() => onPatch(Math.max(0.5, viewScale - 0.1))}>−</button>
        <input
          type="range" min={0.5} max={2} step={0.05} value={viewScale}
          onChange={(e) => onPatch(Number(e.target.value))}
          className="flex-1"
        />
        <button className="btn-panel" onClick={() => onPatch(Math.min(2, viewScale + 0.1))}>+</button>
      </div>
      <p className="text-muted-foreground">Display size: {Math.round(viewScale * 100)}% (measurements unchanged)</p>
    </>
  );
}

// ── Adjust ─────────────────────────────────────────────────────────────
function AdjustSection({
  adapter, attrsAdapter, attrs, nodes, nodeLabels, visibility, onPatch,
  parts = [], onSelectComponent, onPatchParts,
  pickMode = null, onRequestPick,
}: {
  adapter: Adapter | null; attrsAdapter: AttrsAdapter;
  attrs: Record<string, unknown>; nodes: Nodes | null;
  nodeLabels: Record<string, string>; visibility: Visibility;
  onPatch: Props["onPatch"];
  parts?: Component[];
  onSelectComponent?: (id: string | null) => void;
  onPatchParts?: (parts: Component[]) => void;
  pickMode?: PickTool | null;
  onRequestPick?: (tool: PickTool | null) => void;
}) {
  const geoFields  = adapter && nodes ? (adapter.schema?.(nodes) ?? []) : [];
  const attrFields = attrsAdapter.schema(attrs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adder, setAdder] = useState<null | "segment" | "point">(null);
  const [pick, setPick] = useState<string[]>([]);
  const commitTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => () => {
    for (const t of Object.values(commitTimers.current)) clearTimeout(t);
  }, []);

  const commitGeo = (name: string, raw: string) => {
    if (!adapter?.setMeasure || !nodes) return;
    if (raw.trim() === "") { setErrors(e => ({ ...e, [name]: "" })); return; }
    const v = Number(raw);
    if (!Number.isFinite(v)) { setErrors(e => ({ ...e, [name]: "Not a number." })); return; }
    let res = adapter.setMeasure(name, v, nodes);
    if (res && typeof (res as { error?: unknown }).error === "string" && name.length === 2) {
      // Try reversed side name (BA vs AB).
      res = adapter.setMeasure(name[1] + name[0], v, nodes);
    }
    if (res && typeof (res as { error?: unknown }).error === "string") {
      setErrors(e => ({ ...e, [name]: (res as { error: string }).error }));
      return;
    }
    setErrors(e => ({ ...e, [name]: "" }));
    onPatch({ nodes: res as Nodes });
  };

  const commitAttr = (name: string, raw: string) => {
    const res = attrsAdapter.setAttrs(name, raw, attrs);
    if (res && typeof (res as { error?: unknown }).error === "string") {
      setErrors(e => ({ ...e, [name]: (res as { error: string }).error }));
      return;
    }
    setErrors(e => ({ ...e, [name]: "" }));
    const patched = res as Record<string, unknown>;
    const delta: Record<string, unknown> = {};
    for (const k of Object.keys(patched)) {
      if (patched[k] !== attrs[k]) delta[k] = patched[k];
    }
    onPatch(delta);
  };

  const scheduleCommit = (kind: "geo" | "attr", name: string, raw: string) => {
    if (commitTimers.current[name]) clearTimeout(commitTimers.current[name]);
    commitTimers.current[name] = setTimeout(() => {
      if (kind === "geo") commitGeo(name, raw);
      else commitAttr(name, raw);
    }, 60);
  };

  const nodeNames = nodes ? Object.keys(nodes) : [];
  const vis = { ...DEFAULT_VISIBILITY, ...visibility };
  const toggle = (k: VisibilityKey) =>
    onPatch({ visibility: { ...visibility, [k]: !vis[k] } });

  const nodeName = (n: string) => nodeLabels[n] ?? n;
  const draftFor = (name: string, fallback: string): string =>
    drafts[name] !== undefined ? drafts[name] : fallback;

  // Component-driven rows (preferred when parts exist)
  const lineParts  = parts.filter(p => p.kind === "line" && p.nodes?.length === 2);
  const angleParts = parts.filter(p => p.kind === "angle" && p.nodes?.length === 3);

  const patchPart = (id: string, patch: Partial<Component>) => {
    if (!onPatchParts) return;
    onPatchParts(parts.map(p => p.id === id ? { ...p, ...patch, content: { ...p.content, ...patch.content } } : p));
  };
  const removePart = (id: string) => onPatchParts?.(parts.filter(p => p.id !== id));

  const addSegment = (a: string, b: string) => {
    if (!onPatchParts) return;
    onPatchParts([...parts, {
      id: newPartId("ln"), kind: "line", nodes: [a, b],
      appearance: { color: "#3b82f6", thickness: 2, dash: "dashed" },
      behaviour: { visible: true, locked: false },
      content: {},
    }]);
    setAdder(null); setPick([]);
  };

  const addFreePoint = () => {
    if (!nodes || !onPatchParts) return;
    // Generate a unique name P, P1, P2 …
    const existing = new Set(Object.keys(nodes));
    let name = "P"; let i = 1;
    while (existing.has(name)) { name = `P${i++}`; }
    const centre = Object.values(nodes).reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
    const n = Object.values(nodes).length || 1;
    const pos = { x: centre.x / n, y: centre.y / n };
    onPatch({ nodes: { ...nodes, [name]: pos } });
    onPatchParts([...parts, {
      id: newPartId("v"), kind: "vertex", nodes: [name],
      appearance: { color: "currentColor" },
      behaviour: { visible: true, locked: false },
      content: { label: name },
    }]);
    setAdder(null); setPick([]);
  };

  const renderAttrField = (f: Field) => {
    if (f.kind === "number") {
      return (
        <FieldRow key={f.name} label={f.label} locked={f.locked} suffix={f.suffix}
          value={draftFor(f.name, String(f.value))} error={errors[f.name]}
          onChange={(v) => { setDrafts(d => ({ ...d, [f.name]: v })); scheduleCommit("attr", f.name, v); }} />
      );
    }
    if (f.kind === "text") {
      return (
        <FieldRow key={f.name} label={f.label} locked={f.locked} placeholder={f.placeholder}
          value={draftFor(f.name, f.value)} error={errors[f.name]}
          onChange={(v) => { setDrafts(d => ({ ...d, [f.name]: v })); scheduleCommit("attr", f.name, v); }} />
      );
    }
    if (f.kind === "select") {
      return (
        <div key={f.name} className="py-1">
          <div className="flex items-center gap-2">
            <span className="flex-1">{f.label}{f.locked && " 🔒"}</span>
            <select className="input-panel" value={draftFor(f.name, f.value)} disabled={f.locked}
              onChange={(e) => { const v = e.target.value; setDrafts(d => ({ ...d, [f.name]: v })); commitAttr(f.name, v); }}>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      );
    }
    return null;
  };

  const useParts = parts.length > 0 && nodes;

  return (
    <>
      {/* SIDES — component-driven */}
      {useParts && lineParts.length > 0 && (
        <div>
          <div className="section-label">Sides</div>
          {lineParts.map(p => {
            const [aN, bN] = p.nodes!;
            const a = nodes![aN]; const b = nodes![bN];
            const sideName = `${aN}${bN}`;
            const currentLen = a && b ? formatLen(dist(a, b)) : "";
            const draftKey = `part-len-${p.id}`;
            const labelText = p.content?.label;
            const showLabel = p.content?.showLabel !== false;
            const showLength = p.content?.showLength !== false;
            return (
              <div key={p.id} className="border-b border-border/40 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex-1 font-medium">{nodeName(aN)}{nodeName(bN)}</span>
                  {onSelectComponent && (
                    <button className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => onSelectComponent(p.id)} title="Open component settings">edit ▸</button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-14">Length</span>
                  <input className={`input-panel flex-1 text-right ${errors[sideName] ? "border-destructive" : ""}`}
                    value={draftFor(draftKey, currentLen)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts(d => ({ ...d, [draftKey]: v }));
                      scheduleCommit("geo", sideName, v);
                    }} />
                  <span className="text-muted-foreground text-[10px] w-4">cm</span>
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Show length on diagram">
                    <input type="checkbox" checked={showLength}
                      onChange={(e) => patchPart(p.id, { content: { ...p.content, showLength: e.target.checked } })} />
                    show
                  </label>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground w-14">Label</span>
                  <input className="input-panel flex-1 text-right"
                    placeholder="e.g. X, 2x+1, AB (text only — no geometry change)"
                    value={labelText ?? ""}
                    onChange={(e) => patchPart(p.id, { content: { ...p.content, label: e.target.value } })} />
                  <span className="w-4" />
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Show label on diagram">
                    <input type="checkbox" checked={showLabel}
                      onChange={(e) => patchPart(p.id, { content: { ...p.content, showLabel: e.target.checked } })} />
                    show
                  </label>
                </div>
                {errors[sideName] && <div className="text-destructive text-[10px] mt-1">{errors[sideName]}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ANGLES — component-driven, with add / show-hide / remove */}
      {useParts && (
        <div>
          <div className="section-label">Angles</div>
          {angleParts.map(p => {
            const [aN, vN, cN] = p.nodes!;
            const a = nodes![aN]; const v = nodes![vN]; const c = nodes![cN];
            const currentDeg = a && v && c ? Math.round(angleAt(a, v, c)).toString() : "";
            const angleName = `${aN}${vN}${cN}`;
            const draftKey = `part-ang-${p.id}`;
            const custom = p.content?.label;
            return (
              <div key={p.id} className="border-b border-border/40 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex-1 font-medium">∠{nodeName(aN)}{nodeName(vN)}{nodeName(cN)}</span>
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => patchPart(p.id, {
                      behaviour: { ...p.behaviour, visible: p.behaviour?.visible === false },
                    })}
                  >{p.behaviour?.visible === false ? "show" : "hide"}</button>
                  <button
                    className="text-[10px] text-destructive hover:opacity-80"
                    onClick={() => removePart(p.id)}
                  >remove</button>
                  {onSelectComponent && (
                    <button className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => onSelectComponent(p.id)} title="Open component settings">edit ▸</button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-12">Angle</span>
                  <input className={`input-panel flex-1 text-right ${errors[angleName] ? "border-destructive" : ""}`}
                    value={draftFor(draftKey, currentDeg)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDrafts(d => ({ ...d, [draftKey]: val }));
                      scheduleCommit("geo", angleName, val);
                    }} />
                  <span className="text-muted-foreground text-[10px]">°</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground w-12">Label</span>
                  <input className="input-panel flex-1 text-right"
                    placeholder="auto — type X, 60°, θ or blank to hide"
                    value={custom === undefined ? "" : String(custom)}
                    onChange={(e) => patchPart(p.id, { content: { ...p.content, label: e.target.value } })} />
                </div>
                {errors[angleName] && <div className="text-destructive text-[10px] mt-1">{errors[angleName]}</div>}
              </div>
            );
          })}
          {/* Add angle for polygon vertices that don't have one yet */}
          {onPatchParts && nodes && (() => {
            const withAngle = new Set(angleParts.map(p => p.nodes![1]));
            const polygonNames = nodeNames.filter(n => !withAngle.has(n));
            if (polygonNames.length === 0 || nodeNames.length < 3) return null;
            const addAngleAt = (v: string) => {
              const idx = nodeNames.indexOf(v);
              const prev = nodeNames[(idx - 1 + nodeNames.length) % nodeNames.length];
              const next = nodeNames[(idx + 1) % nodeNames.length];
              onPatchParts!([...parts, {
                id: newPartId("ang"), kind: "angle", nodes: [prev, v, next],
                appearance: { color: "currentColor", thickness: 1.3 },
                behaviour: { visible: true, locked: false },
                content: { labelPosition: "inside" },
              }]);
            };
            return (
              <div className="pt-2">
                <div className="text-[10px] text-muted-foreground mb-1">Add angle at:</div>
                <div className="flex flex-wrap gap-1">
                  {polygonNames.map(n => (
                    <button key={n} className="btn-panel text-[11px] px-2 py-1"
                      onClick={() => addAngleAt(n)}>+ ∠{nodeName(n)}</button>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* Add angle between two lines — auto-derives shared vertex. */}
          {onPatchParts && nodes && lineParts.length >= 2 && (
            <AddAngleFromLines
              nodes={nodes}
              nodeLabel={nodeName}
              lineParts={lineParts}
              existingAngles={angleParts}
              onAdd={(triple) => onPatchParts([...parts, {
                id: newPartId("ang"), kind: "angle", nodes: triple,
                appearance: { color: "currentColor", thickness: 1.3 },
                behaviour: { visible: true, locked: false },
                content: { labelPosition: "inside" },
              }])}
            />
          )}
        </div>
      )}

      {/* VERTICES (labels) */}
      {nodeNames.length > 0 && (
        <div>
          <div className="section-label">Vertices</div>
          <div className="grid grid-cols-3 gap-2">
            {nodeNames.map(n => (
              <label key={n} className="text-muted-foreground">
                <span className="block text-[10px]">{n}</span>
                <input className="input-panel w-full"
                  value={nodeLabels[n] ?? n}
                  onChange={(e) => onPatch({ nodeLabels: { ...nodeLabels, [n]: e.target.value } })} />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ADD STRUCTURES — canvas pick mode */}
      {useParts && onPatchParts && onRequestPick && (
        <div>
          <div className="section-label">Add on canvas</div>
          {pickMode ? (
            <div className="rounded border border-primary/40 bg-primary/5 p-2 space-y-1">
              <div className="text-[11px] font-medium">
                {pickMode === "point" && "Click on the diagram to place a point."}
                {pickMode === "segment" && "Click two points on the diagram (existing vertex or empty space)."}
                {pickMode === "circle" && "Click centre, then a point on the circle."}
                {pickMode === "arc" && "Click three points: start, mid, end."}
              </div>
              <div className="text-[10px] text-muted-foreground">Snaps to existing vertices. Press Esc to cancel.</div>
              <button className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => onRequestPick(null)}>Cancel</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              <button className="btn-panel" onClick={() => onRequestPick("point")}>+ Point</button>
              <button className="btn-panel" onClick={() => onRequestPick("segment")}>+ Segment</button>
              <button className="btn-panel" onClick={() => onRequestPick("circle")}>+ Circle</button>
              <button className="btn-panel" onClick={() => onRequestPick("arc")}>+ Arc</button>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            New points are auto-labelled (P, P1, P2 …) and become fully editable components.
          </p>
        </div>
      )}

      {/* Added structure list (parts with dashed appearance are treated as added) */}
      {useParts && onPatchParts && (() => {
        const added = lineParts.filter(p => p.appearance?.dash === "dashed" || p.appearance?.color === "#3b82f6");
        if (added.length === 0) return null;
        return (
          <div>
            <div className="section-label">Added</div>
            <ul className="space-y-1">
              {added.map(p => (
                <li key={p.id} className="flex items-center justify-between text-xs">
                  <span>Segment {nodeName(p.nodes![0])}{nodeName(p.nodes![1])}</span>
                  <div className="flex gap-2">
                    {onSelectComponent && (
                      <button className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => onSelectComponent(p.id)}>edit</button>
                    )}
                    <button className="text-[10px] text-destructive" onClick={() => removePart(p.id)}>remove</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Fallback: no parts — use raw adapter/attr schema */}
      {!useParts && geoFields.filter(f => f.kind === "side").length > 0 && (
        <div>
          <div className="section-label">Sides</div>
          {geoFields.filter(f => f.kind === "side").map(f => (
            <FieldRow key={f.name} label={f.label} locked={"locked" in f && f.locked}
              value={draftFor(f.name, "value" in f ? f.value.toFixed(1) : "")}
              error={errors[f.name]}
              onChange={(v) => { setDrafts(d => ({ ...d, [f.name]: v })); scheduleCommit("geo", f.name, v); }} />
          ))}
        </div>
      )}
      {!useParts && geoFields.filter(f => f.kind === "angle").length > 0 && (
        <div>
          <div className="section-label">Angles</div>
          {geoFields.filter(f => f.kind === "angle").map(f => (
            <FieldRow key={f.name} label={f.label} locked={"locked" in f && f.locked}
              value={draftFor(f.name, "value" in f ? Math.round(f.value).toString() : "")}
              error={errors[f.name]} suffix="°"
              onChange={(v) => { setDrafts(d => ({ ...d, [f.name]: v })); scheduleCommit("geo", f.name, v); }} />
          ))}
        </div>
      )}

      {attrFields.length > 0 && (
        <div>
          <div className="section-label">Properties</div>
          {attrFields.map(renderAttrField)}
        </div>
      )}

      {!useParts && geoFields.length === 0 && attrFields.length === 0 && (
        <p className="text-muted-foreground">
          No adjustable properties for this diagram yet — use Expand to resize
          or drop a new diagram from the toolbar.
        </p>
      )}

      {adapter && nodes && (
        <div>
          <div className="section-label">Visibility</div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(DEFAULT_VISIBILITY) as VisibilityKey[]).map(k => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={vis[k]} onChange={() => toggle(k)} />
                <span className="capitalize">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function FieldRow({ label, value, error, locked, suffix, placeholder, onChange }: {
  label: string; value: string; error?: string; locked?: boolean; suffix?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <span className="flex-1">{label}{locked && " 🔒"}</span>
        <input
          className={`input-panel w-24 text-right ${error ? "border-destructive text-destructive" : ""}`}
          value={value}
          disabled={locked}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="text-muted-foreground w-2">{suffix}</span>}
      </div>
      {error && <div className="text-destructive text-[10px] mt-0.5">{error}</div>}
    </div>
  );
}

// ── Add Component ──────────────────────────────────────────────────────
function AddComponentSection({
  adapter, attrsAdapter, nodes, nodeLabels, components, onChange,
}: {
  adapter: Adapter | null; attrsAdapter: AttrsAdapter;
  nodes: Nodes | null; nodeLabels: Record<string, string>;
  components: LiveComponent[];
  onChange: (c: LiveComponent[]) => void;
}) {
  const menu: ComponentDef[] =
    (adapter?.componentMenu?.() ?? []).length > 0
      ? adapter!.componentMenu!()
      : (attrsAdapter.componentMenu?.() ?? []);

  const [selected, setSelected] = useState<ComponentDef | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});

  const grouped = menu.reduce<Record<ComponentGroup, ComponentDef[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c); return acc;
  }, {} as Record<ComponentGroup, ComponentDef[]>);

  const vertexNames = nodes ? Object.keys(nodes) : [];
  const sideNames = generateSideNames(vertexNames);

  const canCreate = selected && (selected.needs ?? []).every(n => refs[n.key]);

  const create = () => {
    if (!selected) return;
    onChange([...components, { id: newComponentId(), kind: selected.kind, refs }]);
    setSelected(null); setRefs({});
  };

  if (menu.length === 0) {
    return <p className="text-muted-foreground">No components available for this diagram yet.</p>;
  }

  return (
    <>
      {selected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{selected.label}</span>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => { setSelected(null); setRefs({}); }}>← Back</button>
          </div>
          {(selected.needs ?? []).map(n => (
            <label key={n.key} className="block">
              <span className="text-muted-foreground block text-[10px]">{n.label}</span>
              <select
                className="input-panel w-full"
                value={refs[n.key] ?? ""}
                onChange={(e) => setRefs({ ...refs, [n.key]: e.target.value })}
              >
                <option value="">— pick —</option>
                {(n.from === "vertex" ? vertexNames : sideNames).map(v => (
                  <option key={v} value={v}>
                    {n.from === "vertex" ? (nodeLabels[v] ?? v) : v.split("").map(c => nodeLabels[c] ?? c).join("")}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            className="btn-panel-primary w-full"
            disabled={!canCreate}
            onClick={create}
          >Add</button>
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(grouped) as ComponentGroup[]).map(g => (
            <div key={g}>
              <div className="section-label">{g}</div>
              <div className="grid grid-cols-2 gap-1">
                {grouped[g].map(c => (
                  <button
                    key={c.kind}
                    disabled={c.disabled}
                    className={`btn-panel text-left justify-start ${c.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                    onClick={() => {
                      if (c.disabled) return;
                      if ((c.needs ?? []).length === 0) {
                        onChange([...components, { id: newComponentId(), kind: c.kind, refs: {} }]);
                      } else {
                        setSelected(c);
                      }
                    }}
                    title={c.disabled ? "Coming soon" : ""}
                  >+ {c.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {components.length > 0 && (
        <div className="mt-4">
          <div className="section-label">Added</div>
          <ul className="space-y-1">
            {components.map(c => (
              <li key={c.id} className="flex items-center justify-between">
                <span>{c.kind} <span className="text-muted-foreground">{Object.values(c.refs).join(" ")}</span></span>
                <button className="text-destructive text-[10px]" onClick={() => onChange(components.filter(x => x.id !== c.id))}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// ── helpers ────────────────────────────────────────────────────────────
function centroid(nodes: Nodes): Point {
  const ps = Object.values(nodes);
  const sx = ps.reduce((s, p) => s + p.x, 0);
  const sy = ps.reduce((s, p) => s + p.y, 0);
  return { x: sx / ps.length, y: sy / ps.length };
}
function rotateNodes(nodes: Nodes, c: Point, deg: number): Nodes {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const out: Nodes = {};
  for (const k of Object.keys(nodes)) {
    const p = nodes[k]; const dx = p.x - c.x, dy = p.y - c.y;
    out[k] = { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
  }
  return out;
}
function flipNodes(nodes: Nodes, c: Point, axis: "x" | "y"): Nodes {
  const out: Nodes = {};
  for (const k of Object.keys(nodes)) {
    const p = nodes[k];
    out[k] = axis === "x"
      ? { x: 2 * c.x - p.x, y: p.y }
      : { x: p.x, y: 2 * c.y - p.y };
  }
  return out;
}
function generateSideNames(vertexNames: string[]): string[] {
  const sides: string[] = [];
  for (let i = 0; i < vertexNames.length; i++) {
    for (let j = i + 1; j < vertexNames.length; j++) {
      sides.push(vertexNames[i] + vertexNames[j]);
    }
  }
  return sides;
}

// ── Add angle from two lines ───────────────────────────────────────────
function AddAngleFromLines({
  nodes, nodeLabel, lineParts, existingAngles, onAdd,
}: {
  nodes: Nodes;
  nodeLabel: (n: string) => string;
  lineParts: Component[];
  existingAngles: Component[];
  onAdd: (triple: [string, string, string]) => void;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const labelOf = (p: Component) =>
    `Line ${nodeLabel(p.nodes![0])}${nodeLabel(p.nodes![1])}`;

  const shared = (() => {
    const la = lineParts.find(p => p.id === a);
    const lb = lineParts.find(p => p.id === b);
    if (!la || !lb || la.id === lb.id) return null;
    const [a1, a2] = la.nodes!;
    const [b1, b2] = lb.nodes!;
    const common = [a1, a2].find(n => n === b1 || n === b2);
    if (!common) return null;
    const arm1 = a1 === common ? a2 : a1;
    const arm2 = b1 === common ? b2 : b1;
    return { v: common, arm1, arm2 };
  })();

  const duplicate = shared ? existingAngles.some(p => {
    const [x, v, y] = p.nodes!;
    if (v !== shared.v) return false;
    const key = [x, y].sort().join(",");
    return key === [shared.arm1, shared.arm2].sort().join(",");
  }) : false;

  const canAdd = !!shared && !duplicate;
  const computedDeg = shared
    ? Math.round(angleAt(nodes[shared.arm1], nodes[shared.v], nodes[shared.arm2]))
    : null;

  return (
    <div className="pt-3 border-t border-border/40 mt-2">
      <div className="text-[10px] text-muted-foreground mb-1">Add angle between two lines:</div>
      <div className="grid grid-cols-2 gap-1 mb-1">
        <select className="input-panel text-[11px]" value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Arm 1 —</option>
          {lineParts.map(p => <option key={p.id} value={p.id}>{labelOf(p)}</option>)}
        </select>
        <select className="input-panel text-[11px]" value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">Arm 2 —</option>
          {lineParts.map(p => <option key={p.id} value={p.id}>{labelOf(p)}</option>)}
        </select>
      </div>
      {shared && computedDeg != null && (
        <div className="text-[10px] text-muted-foreground mb-1">
          Shared vertex: <span className="font-medium text-foreground">{nodeLabel(shared.v)}</span>
          {" · "}measured: <span className="font-medium text-foreground">{computedDeg}°</span>
        </div>
      )}
      {a && b && !shared && (
        <div className="text-[10px] text-destructive mb-1">Lines must meet at a shared vertex.</div>
      )}
      {duplicate && (
        <div className="text-[10px] text-destructive mb-1">This angle already exists.</div>
      )}
      <button
        className="btn-panel w-full text-[11px]"
        disabled={!canAdd}
        onClick={() => {
          if (!shared) return;
          onAdd([shared.arm1, shared.v, shared.arm2]);
          setA(""); setB("");
        }}
      >+ Add angle</button>
    </div>
  );
}
