// CircleEnginePanel — right-side property panel matching triangle/line.
// Portals to <body>, sets --geometry-panel-offset so the editor content
// splits horizontally instead of being covered.

import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { UCECircle, UCEModel, LineStyle, CircleType } from "./types";
import { newCircleId, DEFAULT_CIRCLE } from "./types";
import { CIRCLE_TYPES } from "./presets";

interface Props {
  open: boolean;
  onClose: () => void;
  model: UCEModel;
  selection: string[];
  onChange: (m: UCEModel) => void;
  onDeleteDiagram?: () => void;
}

const COLORS = [
  { value: "#111827", label: "Black" },
  { value: "#ef4444", label: "Red" },
  { value: "#f59e0b", label: "Orange" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
];

const FILLS = [
  { value: "none",    label: "No fill" },
  { value: "#ef4444", label: "Red" },
  { value: "#f59e0b", label: "Orange" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#111827", label: "Black" },
];

export function CircleEnginePanel({ open, onClose, model, selection, onChange, onDeleteDiagram }: Props) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--geometry-panel-offset");
    root.style.setProperty("--geometry-panel-offset", expanded ? "clamp(320px, 33vw, 440px)" : "44px");
    return () => {
      if (previous) root.style.setProperty("--geometry-panel-offset", previous);
      else root.style.removeProperty("--geometry-panel-offset");
    };
  }, [open, expanded]);

  if (!open || typeof document === "undefined") return null;

  const guard = (e: SyntheticEvent) => e.stopPropagation();
  const shellClass = expanded
    ? "fixed inset-y-0 right-0 z-50 w-[clamp(320px,33vw,440px)] shadow-2xl border-l border-border overflow-hidden flex flex-col"
    : "fixed inset-y-0 right-0 z-50 w-11 shadow-2xl border-l border-border overflow-hidden flex flex-col items-center";
  const panelStyle = { background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

  const foldButton = (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted/60"
      title={expanded ? "Fold settings" : "Show settings"}
      aria-label={expanded ? "Fold settings" : "Show settings"}
    >
      {expanded ? "›" : "⚙"}
    </button>
  );

  if (!expanded) {
    return createPortal(
      <aside className={shellClass} style={panelStyle}
        onMouseDown={guard} onPointerDown={guard} onClick={guard} onKeyDown={guard}>
        <div className="pt-3">{foldButton}</div>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          Settings
        </div>
      </aside>,
      document.body,
    );
  }

  return createPortal(
    <div className={shellClass} style={panelStyle}
      onMouseDown={guard} onPointerDown={guard} onClick={guard} onKeyDown={guard}>
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Circle settings</h2>
        <div className="flex items-center gap-2">
          {foldButton}
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close ✕</button>
        </div>
      </header>

      {onDeleteDiagram && (
        <DeleteDiagramRow onDelete={() => { onDeleteDiagram(); onClose(); }} />
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6 text-xs">
        <CirclePanel model={model} selection={selection} onChange={onChange} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}

function DeleteDiagramRow({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="px-4 py-2 border-b border-border">
      {!armed ? (
        <button onClick={() => setArmed(true)}
          className="w-full text-[11px] text-destructive hover:bg-destructive/10 rounded px-2 py-1.5 border border-destructive/30">
          🗑 Delete entire diagram
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-destructive">Delete diagram?</span>
          <button onClick={onDelete} className="text-[11px] px-2 py-1 rounded bg-destructive text-destructive-foreground hover:brightness-110">Yes, delete</button>
          <button onClick={() => setArmed(false)} className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted/40">Cancel</button>
        </div>
      )}
    </div>
  );
}

/* ---------- shared bits ---------- */

function Header({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1">{children}</div>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex-1 text-[11px]">{label}</span>
      <div className="w-40 flex justify-end">{children}</div>
    </div>
  );
}
function NumInput({ value, onCommit, step = 1, min }: { value: number; onCommit: (n: number) => void; step?: number; min?: number }) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      defaultValue={Number(value.toFixed(2))}
      key={value}
      onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onCommit(n); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="input-panel w-full text-right"
    />
  );
}

/* ---------- Circle panel ---------- */

function CirclePanel({ model, selection, onChange, onClose }: { model: UCEModel; selection: string[]; onChange: (m: UCEModel) => void; onClose: () => void }) {
  const circle = model.circles.find((c) => selection.includes(c.id)) ?? model.circles[0];
  if (!circle) return <p className="text-muted-foreground pt-4">This asset has no circles.</p>;

  const setCircle = (patch: Partial<UCECircle>) => {
    const circles = model.circles.map((c) => c.id === circle.id ? { ...c, ...patch } : c);
    onChange({ ...model, circles });
  };

  const duplicate = () => {
    const clone: UCECircle = { ...circle, id: newCircleId(), cx: circle.cx + 20, cy: circle.cy + 20 };
    onChange({ ...model, circles: [...model.circles, clone] });
  };

  const remove = () => {
    const circles = model.circles.filter((c) => c.id !== circle.id);
    onChange({ ...model, circles });
    if (circles.length === 0) onClose();
  };

  const isArc = circle.type !== "circle";
  const canEditArcAngles = isArc && circle.type !== "semicircle" && circle.type !== "quadrant";

  return (
    <>
      <Header>Geometry</Header>
      <Row label="Radius"><NumInput value={circle.r} min={1} onCommit={(v) => circle.locked || setCircle({ r: Math.max(1, v) })} /></Row>
      <Row label="X (centre)"><NumInput value={circle.cx} onCommit={(v) => circle.locked || setCircle({ cx: v })} /></Row>
      <Row label="Y (centre)"><NumInput value={circle.cy} onCommit={(v) => circle.locked || setCircle({ cy: v })} /></Row>

      <Header>Type</Header>
      <Row label="Circle type">
        <select className="input-panel w-full" value={circle.type}
          onChange={(e) => setCircle({ type: e.target.value as CircleType })}>
          {CIRCLE_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
        </select>
      </Row>

      {isArc && (
        <>
          <Header>Arc</Header>
          <Row label="Start (°)">
            <NumInput value={circle.startDeg} onCommit={(v) => setCircle({ startDeg: v })} />
          </Row>
          {canEditArcAngles && (
            <Row label="Sweep (°)">
              <NumInput value={circle.sweepDeg} onCommit={(v) => setCircle({ sweepDeg: Math.max(1, Math.min(360, v)) })} />
            </Row>
          )}
        </>
      )}

      <Header>Outline</Header>
      <Row label="Thickness">
        <input type="range" min={1} max={6} step={0.5} value={circle.thickness}
          onChange={(e) => setCircle({ thickness: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Colour">
        <select className="input-panel w-full"
          value={COLORS.some((c) => c.value === circle.color) ? circle.color : "#111827"}
          onChange={(e) => setCircle({ color: e.target.value })}>
          {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Row>
      <Row label="Style">
        <select className="input-panel w-full" value={circle.style}
          onChange={(e) => setCircle({ style: e.target.value as LineStyle })}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </Row>

      <Header>Fill</Header>
      <Row label="Fill colour">
        <select className="input-panel w-full" value={circle.fill}
          onChange={(e) => setCircle({ fill: e.target.value })}>
          {FILLS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </Row>
      {circle.fill !== "none" && (
        <Row label="Fill opacity">
          <input type="range" min={0} max={1} step={0.05} value={circle.fillOpacity}
            onChange={(e) => setCircle({ fillOpacity: Number(e.target.value) })} className="w-full" />
        </Row>
      )}

      <Header>Centre</Header>
      <Row label="Show centre">
        <input type="checkbox" checked={circle.showCentre}
          onChange={(e) => setCircle({ showCentre: e.target.checked })} />
      </Row>
      {circle.showCentre && (
        <Row label="Centre label">
          <input className="input-panel w-full text-right" defaultValue={circle.centreLabel}
            placeholder="O" onBlur={(e) => setCircle({ centreLabel: e.target.value })} />
        </Row>
      )}

      <Header>Radii</Header>
      <Row label="Count">
        <select className="input-panel w-full" value={circle.radii.length}
          onChange={(e) => {
            const n = Number(e.target.value);
            const current = circle.radii;
            let next: number[];
            if (n === 0) next = [];
            else if (n <= current.length) next = current.slice(0, n);
            else {
              next = [...current];
              while (next.length < n) next.push((next.length * (360 / Math.max(n, 1))) % 360);
            }
            setCircle({ radii: next });
          }}>
          {[0, 1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Row>
      {circle.radii.map((deg, i) => (
        <Row key={i} label={`Radius ${i + 1} angle (°)`}>
          <NumInput value={deg} onCommit={(v) => {
            const next = [...circle.radii];
            next[i] = v;
            setCircle({ radii: next });
          }} />
        </Row>
      ))}

      <Header>Diameter</Header>
      <Row label="Show diameter">
        <input type="checkbox" checked={circle.showDiameter}
          onChange={(e) => setCircle({ showDiameter: e.target.checked })} />
      </Row>
      {circle.showDiameter && (
        <Row label="Angle (°)">
          <NumInput value={circle.diameterAngleDeg} onCommit={(v) => setCircle({ diameterAngleDeg: v })} />
        </Row>
      )}

      <Header>Rim labels</Header>
      {circle.rimLabels.map((lab, i) => (
        <div key={i} className="flex items-center gap-1 py-1">
          <input className="input-panel w-14 text-right" defaultValue={lab.text}
            placeholder="A" onBlur={(e) => {
              const next = [...circle.rimLabels];
              next[i] = { ...next[i], text: e.target.value };
              setCircle({ rimLabels: next });
            }} />
          <input type="number" className="input-panel flex-1 text-right" defaultValue={lab.angleDeg}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              const next = [...circle.rimLabels];
              next[i] = { ...next[i], angleDeg: v };
              setCircle({ rimLabels: next });
            }} />
          <button className="btn-panel text-destructive px-2"
            onClick={() => setCircle({ rimLabels: circle.rimLabels.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button className="btn-panel w-full mt-1"
        onClick={() => {
          const angle = (circle.rimLabels.length * 60) % 360;
          const letter = String.fromCharCode(65 + circle.rimLabels.length);
          setCircle({ rimLabels: [...circle.rimLabels, { angleDeg: angle, text: letter }] });
        }}>
        + Add label
      </button>

      <Header>Actions</Header>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button className="btn-panel" onClick={duplicate}>Duplicate</button>
        <button className="btn-panel text-destructive" onClick={remove}>Delete</button>
      </div>
      <Row label="Lock">
        <input type="checkbox" checked={circle.locked}
          onChange={(e) => setCircle({ locked: e.target.checked })} />
      </Row>

      {model.circles.length >= 2 && selection.length === 2 && (
        <>
          <Header>Two-circle relations</Header>
          <p className="text-[10px] text-muted-foreground pt-1">
            (Distance, concentric, equal radius, touch, intersect — coming soon.)
          </p>
        </>
      )}

      {/* silence unused import warning */}
      <span style={{ display: "none" }}>{DEFAULT_CIRCLE.type}</span>
    </>
  );
}
