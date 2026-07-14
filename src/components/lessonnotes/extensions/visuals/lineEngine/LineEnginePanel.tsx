// LineEnginePanel — right-side property panel matching triangle's shell.
//
// Portals to <body>, sets --geometry-panel-offset so the editor content
// splits horizontally instead of being covered. Two content bodies
// selected by presetId: "line" (LinePanel) or "angle" (AnglePanel).

import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { ULELine, ULEModel, LineStyle } from "./types";
import { newLineId } from "./types";
import { lineAngleDeg, lineLength, rotateAbout, setAngleBetween, setEndpointsFromPolar } from "./geometry";

interface Props {
  open: boolean;
  onClose: () => void;
  model: ULEModel;
  selection: string[];
  onChange: (m: ULEModel) => void;
  onDeleteDiagram?: () => void;
}

type EndPreset = "plain" | "ray" | "line" | "segment";

function endsToPreset(a: ULELine["endA"], b: ULELine["endB"]): EndPreset {
  if (a === "arrow" && b === "arrow") return "line";
  if (b === "arrow" || a === "arrow") return "ray";
  if (a === "closedDot" && b === "closedDot") return "segment";
  return "plain";
}

function presetToEnds(p: EndPreset): { endA: ULELine["endA"]; endB: ULELine["endB"] } {
  switch (p) {
    case "ray":     return { endA: "plain", endB: "arrow" };
    case "line":    return { endA: "arrow", endB: "arrow" };
    case "segment": return { endA: "closedDot", endB: "closedDot" };
    default:        return { endA: "plain", endB: "plain" };
  }
}

const COLORS = [
  { value: "#111827", label: "Black" },
  { value: "#ef4444", label: "Red" },
  { value: "#f59e0b", label: "Orange" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
];

/* ---------- shared shell ---------- */

export function LineEnginePanel({ open, onClose, model, selection, onChange, onDeleteDiagram }: Props) {
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

  const isAngle = model.presetId === "angle";
  const guard = (e: SyntheticEvent) => e.stopPropagation();

  const shellClass = expanded
    ? "fixed inset-y-0 right-0 z-50 w-[clamp(320px,33vw,440px)] shadow-2xl border-l border-border overflow-hidden flex flex-col"
    : "fixed inset-y-0 right-0 z-50 w-11 shadow-2xl border-l border-border overflow-hidden flex flex-col items-center";
  const panelStyle = { background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

  const foldButton = (
    <button
      type="button"
      onClick={() => setExpanded(v => !v)}
      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted/60"
      title={expanded ? "Fold settings" : "Show settings"}
      aria-label={expanded ? "Fold settings" : "Show settings"}
    >
      {expanded ? "›" : "⚙"}
    </button>
  );

  if (!expanded) {
    return createPortal(
      <aside
        className={shellClass}
        style={panelStyle}
        onMouseDown={guard}
        onPointerDown={guard}
        onClick={guard}
        onKeyDown={guard}
      >
        <div className="pt-3">{foldButton}</div>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          Settings
        </div>
      </aside>,
      document.body,
    );
  }

  return createPortal(
    <div
      className={shellClass}
      style={panelStyle}
      onMouseDown={guard}
      onPointerDown={guard}
      onClick={guard}
      onKeyDown={guard}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{isAngle ? "Angle" : "Line"} settings</h2>
        <div className="flex items-center gap-2">
          {foldButton}
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close ✕</button>
        </div>
      </header>

      {onDeleteDiagram && (
        <DeleteDiagramRow onDelete={() => { onDeleteDiagram(); onClose(); }} />
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6 text-xs">
        {isAngle
          ? <AnglePanel model={model} onChange={onChange} />
          : <LinePanel model={model} selection={selection} onChange={onChange} onClose={onClose} />}
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
        <button
          onClick={() => setArmed(true)}
          className="w-full text-[11px] text-destructive hover:bg-destructive/10 rounded px-2 py-1.5 border border-destructive/30"
        >
          🗑 Delete entire diagram
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-destructive">Delete diagram?</span>
          <button onClick={onDelete}
            className="text-[11px] px-2 py-1 rounded bg-destructive text-destructive-foreground hover:brightness-110">
            Yes, delete
          </button>
          <button onClick={() => setArmed(false)}
            className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted/40">
            Cancel
          </button>
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

function NumInput({ value, onCommit, step = 1 }: { value: number; onCommit: (n: number) => void; step?: number }) {
  return (
    <input
      type="number"
      step={step}
      defaultValue={Number(value.toFixed(2))}
      key={value}
      onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onCommit(n); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="input-panel w-full text-right"
    />
  );
}

/* ---------- Line panel ---------- */

function LinePanel({ model, selection, onChange, onClose }: { model: ULEModel; selection: string[]; onChange: (m: ULEModel) => void; onClose: () => void }) {
  const line = model.lines.find((l) => selection.includes(l.id)) ?? model.lines[0];
  if (!line) return <p className="text-muted-foreground pt-4">This asset has no lines.</p>;

  const setLine = (patch: Partial<ULELine>) => {
    const lines = model.lines.map((l) => l.id === line.id ? { ...l, ...patch } : l);
    onChange({ ...model, lines });
  };

  const len = lineLength(line);
  const ang = lineAngleDeg(line);
  const endPreset = endsToPreset(line.endA, line.endB);
  const locked = line.lockLen && line.lockAngle;

  const duplicate = () => {
    const clone: ULELine = { ...line, id: newLineId(), ax: line.ax + 20, ay: line.ay + 20, bx: line.bx + 20, by: line.by + 20 };
    onChange({ ...model, lines: [...model.lines, clone] });
  };

  const remove = () => {
    const lines = model.lines.filter((l) => l.id !== line.id);
    onChange({ ...model, lines });
    if (lines.length === 0) onClose();
  };

  return (
    <>
      <Header>Geometry</Header>
      <Row label="Length"><NumInput value={len} onCommit={(v) => !locked && setLine(setEndpointsFromPolar(line, Math.max(1, v), ang))} /></Row>
      <Row label="Rotation (°)"><NumInput value={ang} onCommit={(v) => !locked && setLine(setEndpointsFromPolar(line, len, v))} /></Row>
      <Row label="X"><NumInput value={line.ax} onCommit={(v) => !locked && setLine({ ax: v, bx: line.bx + (v - line.ax) })} /></Row>
      <Row label="Y"><NumInput value={line.ay} onCommit={(v) => !locked && setLine({ ay: v, by: line.by + (v - line.ay) })} /></Row>

      <Header>Appearance</Header>
      <Row label="Thickness">
        <input type="range" min={1} max={6} step={0.5} value={line.thickness}
          onChange={(e) => setLine({ thickness: Number(e.target.value) })}
          className="w-full" />
      </Row>
      <Row label="Colour">
        <select className="input-panel w-full"
          value={COLORS.some(c => c.value === line.color) ? line.color : "#111827"}
          onChange={(e) => setLine({ color: e.target.value })}>
          {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Row>
      <Row label="Style">
        <select className="input-panel w-full" value={line.style}
          onChange={(e) => setLine({ style: e.target.value as LineStyle })}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </Row>
      <Row label="End style">
        <select className="input-panel w-full" value={endPreset}
          onChange={(e) => setLine(presetToEnds(e.target.value as EndPreset))}>
          <option value="plain">Plain</option>
          <option value="ray">Arrow (ray)</option>
          <option value="line">Double arrow</option>
          <option value="segment">Dot both ends</option>
        </select>
      </Row>

      <Header>Actions</Header>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button className="btn-panel" onClick={duplicate}>Duplicate</button>
        <button className="btn-panel text-destructive" onClick={remove}>Delete</button>
      </div>
      <Row label="Lock line">
        <input type="checkbox" checked={locked}
          onChange={(e) => setLine({ lockLen: e.target.checked, lockAngle: e.target.checked })} />
      </Row>
    </>
  );
}

/* ---------- Angle panel ---------- */

function AnglePanel({ model, onChange }: { model: ULEModel; onChange: (m: ULEModel) => void }) {
  const a = model.lines[0];
  const b = model.lines[1];
  const mark = model.angleMarks[0];
  if (!a || !b || !mark) return <p className="text-muted-foreground pt-4">Angle not configured.</p>;

  const armALen = lineLength(a);
  const armBLen = lineLength(b);
  const rotation = lineAngleDeg(a);
  const angleSize = ((lineAngleDeg(b) - lineAngleDeg(a)) % 360 + 360) % 360;
  const vx = a.ax, vy = a.ay;
  const locked = a.lockLen && a.lockAngle;

  const commitLines = (l1: ULELine, l2: ULELine) => {
    onChange({ ...model, lines: model.lines.map((l) => l.id === l1.id ? l1 : l.id === l2.id ? l2 : l) });
  };

  const setAngleSize = (deg: number) => {
    if (locked) return;
    const b2 = setAngleBetween(a, b, deg);
    commitLines(a, setEndpointsFromPolar(b2, armBLen, lineAngleDeg(b2)));
  };
  const setArmA = (len: number) => { if (!locked) commitLines(setEndpointsFromPolar(a, Math.max(1, len), lineAngleDeg(a)), b); };
  const setArmB = (len: number) => { if (!locked) commitLines(a, setEndpointsFromPolar(b, Math.max(1, len), lineAngleDeg(b))); };
  const setRotation = (deg: number) => {
    if (locked) return;
    const delta = deg - rotation;
    commitLines(rotateAbout(a, vx, vy, delta), rotateAbout(b, vx, vy, delta));
  };
  const setVertex = (nx: number, ny: number) => {
    if (locked) return;
    const dx = nx - vx, dy = ny - vy;
    commitLines(
      { ...a, ax: a.ax + dx, ay: a.ay + dy, bx: a.bx + dx, by: a.by + dy },
      { ...b, ax: b.ax + dx, ay: b.ay + dy, bx: b.bx + dx, by: b.by + dy },
    );
  };
  const setBothArms = (patch: Partial<ULELine>) => commitLines({ ...a, ...patch }, { ...b, ...patch });
  const setMark = (patch: Partial<typeof mark>) => onChange({ ...model, angleMarks: [{ ...mark, ...patch }] });

  return (
    <>
      <Header>Angle</Header>
      <Row label="Size (°)"><NumInput value={angleSize} onCommit={setAngleSize} /></Row>
      <Row label="Arm A length"><NumInput value={armALen} onCommit={setArmA} /></Row>
      <Row label="Arm B length"><NumInput value={armBLen} onCommit={setArmB} /></Row>
      <Row label="Rotation (°)"><NumInput value={rotation} onCommit={setRotation} /></Row>
      <Row label="Vertex X"><NumInput value={vx} onCommit={(v) => setVertex(v, vy)} /></Row>
      <Row label="Vertex Y"><NumInput value={vy} onCommit={(v) => setVertex(vx, v)} /></Row>

      <Header>Marker</Header>
      <Row label="Show arc">
        <input type="checkbox" checked={mark.showArc}
          onChange={(e) => setMark({ showArc: e.target.checked })} />
      </Row>
      <Row label="Show value (°)">
        <input type="checkbox" checked={mark.showValue}
          onChange={(e) => setMark({ showValue: e.target.checked })} />
      </Row>
      <Row label="Label">
        <input className="input-panel w-full text-right"
          defaultValue={mark.label}
          placeholder="A, x, θ…"
          onBlur={(e) => setMark({ label: e.target.value })} />
      </Row>

      <Header>Appearance</Header>
      <Row label="Thickness">
        <input type="range" min={1} max={6} step={0.5} value={a.thickness}
          onChange={(e) => setBothArms({ thickness: Number(e.target.value) })}
          className="w-full" />
      </Row>
      <Row label="Colour">
        <select className="input-panel w-full"
          value={COLORS.some(c => c.value === a.color) ? a.color : "#111827"}
          onChange={(e) => setBothArms({ color: e.target.value })}>
          {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Row>
      <Row label="Style">
        <select className="input-panel w-full" value={a.style}
          onChange={(e) => setBothArms({ style: e.target.value as LineStyle })}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </Row>

      <Header>Actions</Header>
      <Row label="Lock angle">
        <input type="checkbox" checked={locked}
          onChange={(e) => setBothArms({ lockLen: e.target.checked, lockAngle: e.target.checked })} />
      </Row>
    </>
  );
}
