// SolidEnginePanel — right-side property panel for the Universal Solid Engine.

import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { UCESolid, UCESolidModel, LineStyle, SolidType, HiddenEdgeMode, FillMode } from "./types";
import { newSolidId, newLabelId, MEASUREMENT_LABEL, MEASUREMENT_LETTER } from "./types";
import { SOLID_TYPES, SOLID_TYPE_LABEL, hasDepth } from "./presets";

interface Props {
  open: boolean;
  onClose: () => void;
  model: UCESolidModel;
  selection: string[];
  onChange: (m: UCESolidModel) => void;
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

export function SolidEnginePanel({ open, onClose, model, selection, onChange, onDeleteDiagram }: Props) {
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
        <h2 className="text-sm font-semibold">3D solid settings</h2>
        <div className="flex items-center gap-2">
          {foldButton}
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close ✕</button>
        </div>
      </header>

      {onDeleteDiagram && (
        <DeleteDiagramRow onDelete={() => { onDeleteDiagram(); onClose(); }} />
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6 text-xs">
        <SolidPanel model={model} selection={selection} onChange={onChange} onClose={onClose} />
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

function SolidPanel({ model, selection, onChange, onClose }: { model: UCESolidModel; selection: string[]; onChange: (m: UCESolidModel) => void; onClose: () => void }) {
  const s = model.solids.find((x) => selection.includes(x.id)) ?? model.solids[0];
  if (!s) return <p className="text-muted-foreground pt-4">This asset has no solid.</p>;

  const setSolid = (patch: Partial<UCESolid>) => {
    const solids = model.solids.map((x) => x.id === s.id ? { ...x, ...patch } : x);
    onChange({ ...model, solids });
  };

  const duplicate = () => {
    const clone: UCESolid = { ...s, id: newSolidId(), x: s.x + 20, y: s.y + 20 };
    onChange({ ...model, solids: [...model.solids, clone] });
  };
  const remove = () => {
    const solids = model.solids.filter((x) => x.id !== s.id);
    onChange({ ...model, solids });
    if (solids.length === 0) onClose();
  };

  const showDepth = hasDepth(s.type);
  const isCurved = s.type === "cylinder" || s.type === "cone" || s.type === "sphere" || s.type === "hemisphere";

  return (
    <>
      <Header>Solid type</Header>
      <Row label="Type">
        <select className="input-panel w-full" value={s.type}
          onChange={(e) => setSolid({ type: e.target.value as SolidType })}>
          {SOLID_TYPES.map((t) => <option key={t} value={t}>{SOLID_TYPE_LABEL[t]}</option>)}
        </select>
      </Row>

      <Header>Size</Header>
      <Row label="Uniform size">
        <input type="range" min={0.3} max={3} step={0.05} value={s.size}
          onChange={(e) => setSolid({ size: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Width"><NumInput value={s.width} min={5} onCommit={(v) => setSolid({ width: Math.max(5, v) })} /></Row>
      <Row label="Height"><NumInput value={s.height} min={5} onCommit={(v) => setSolid({ height: Math.max(5, v) })} /></Row>
      {showDepth && (
        <Row label="Depth"><NumInput value={s.depth} min={5} onCommit={(v) => setSolid({ depth: Math.max(5, v) })} /></Row>
      )}

      <Header>Rotation</Header>
      <Row label="X-axis (°)">
        <input type="range" min={-180} max={180} step={1} value={s.rotX}
          onChange={(e) => setSolid({ rotX: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Y-axis (°)">
        <input type="range" min={-180} max={180} step={1} value={s.rotY}
          onChange={(e) => setSolid({ rotY: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Z-axis (°)">
        <input type="range" min={-180} max={180} step={1} value={s.rotZ}
          onChange={(e) => setSolid({ rotZ: Number(e.target.value) })} className="w-full" />
      </Row>

      <Header>Position</Header>
      <Row label="X"><NumInput value={s.x} onCommit={(v) => setSolid({ x: v })} /></Row>
      <Row label="Y"><NumInput value={s.y} onCommit={(v) => setSolid({ y: v })} /></Row>

      <Header>Outline</Header>
      <Row label="Thickness">
        <input type="range" min={1} max={6} step={0.5} value={s.thickness}
          onChange={(e) => setSolid({ thickness: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Colour">
        <select className="input-panel w-full"
          value={COLORS.some((c) => c.value === s.color) ? s.color : "#111827"}
          onChange={(e) => setSolid({ color: e.target.value })}>
          {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Row>
      <Row label="Style">
        <select className="input-panel w-full" value={s.style}
          onChange={(e) => setSolid({ style: e.target.value as LineStyle })}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </Row>

      <Header>Fill</Header>
      <Row label="Mode">
        <select className="input-panel w-full" value={s.fillMode}
          onChange={(e) => setSolid({ fillMode: e.target.value as FillMode })}>
          <option value="none">No fill</option>
          <option value="solid">Solid</option>
          <option value="transparent">Transparent</option>
        </select>
      </Row>
      {s.fillMode !== "none" && (
        <>
          <Row label="Colour">
            <select className="input-panel w-full"
              value={COLORS.some((c) => c.value === s.fillColor) ? s.fillColor : "#3b82f6"}
              onChange={(e) => setSolid({ fillColor: e.target.value })}>
              {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Row>
          {s.fillMode === "transparent" && (
            <Row label="Opacity">
              <input type="range" min={0} max={1} step={0.05} value={s.fillOpacity}
                onChange={(e) => setSolid({ fillOpacity: Number(e.target.value) })} className="w-full" />
            </Row>
          )}
        </>
      )}

      <Header>Hidden edges</Header>
      <Row label="Display">
        <select className="input-panel w-full" value={s.hiddenEdges}
          onChange={(e) => setSolid({ hiddenEdges: e.target.value as HiddenEdgeMode })}>
          <option value="hide">Hide</option>
          <option value="dashed">Dashed</option>
          <option value="show">Show normally</option>
        </select>
      </Row>

      <Header>Labels</Header>
      {s.labels.map((lab, i) => (
        <div key={lab.id} className="flex items-center gap-1 py-1">
          <input className="input-panel w-14 text-right" defaultValue={lab.text}
            placeholder="A" onBlur={(e) => {
              const next = [...s.labels];
              next[i] = { ...next[i], text: e.target.value };
              setSolid({ labels: next });
            }} />
          <input type="number" className="input-panel w-16 text-right" defaultValue={lab.dx}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              const next = [...s.labels];
              next[i] = { ...next[i], dx: v };
              setSolid({ labels: next });
            }} />
          <input type="number" className="input-panel w-16 text-right" defaultValue={lab.dy}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              const next = [...s.labels];
              next[i] = { ...next[i], dy: v };
              setSolid({ labels: next });
            }} />
          <button className="btn-panel text-destructive px-2"
            onClick={() => setSolid({ labels: s.labels.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button className="btn-panel w-full mt-1"
        onClick={() => {
          const letter = String.fromCharCode(65 + s.labels.length);
          setSolid({ labels: [...s.labels, { id: newLabelId(), text: letter, dx: 0, dy: -60 }] });
        }}>
        + Add label
      </button>

      <Header>Measurements</Header>
      {(["height", "width", "length", "radius", "diameter", "slantHeight"] as const).map((k) => {
        if ((k === "radius" || k === "diameter") && !isCurved) return null;
        if (k === "slantHeight" && !(s.type === "cone" || s.type === "pyramid" || s.type === "squarePyramid" || s.type === "triangularPyramid")) return null;
        const entry = s.measurements[k];
        return (
          <div key={k} className="border-b border-border/40 pb-1 mb-1">
            <Row label={MEASUREMENT_LABEL[k]}>
              <input type="checkbox" checked={entry.enabled}
                onChange={(e) => setSolid({
                  measurements: { ...s.measurements, [k]: { ...entry, enabled: e.target.checked } },
                })} />
            </Row>
            {entry.enabled && (
              <div className="flex items-center gap-2 py-1 pl-3">
                <span className="flex-1 text-[11px] text-muted-foreground">Value</span>
                <input
                  className="input-panel w-40 text-right"
                  placeholder={MEASUREMENT_LETTER[k]}
                  defaultValue={entry.value}
                  key={entry.value}
                  onBlur={(e) => setSolid({
                    measurements: { ...s.measurements, [k]: { ...entry, value: e.target.value } },
                  })}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                />
              </div>
            )}
          </div>
        );
      })}

      <Header>Actions</Header>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button className="btn-panel" onClick={duplicate}>Duplicate</button>
        <button className="btn-panel text-destructive" onClick={remove}>Delete</button>
      </div>
      <Row label="Lock">
        <input type="checkbox" checked={s.locked}
          onChange={(e) => setSolid({ locked: e.target.checked })} />
      </Row>
    </>
  );
}
