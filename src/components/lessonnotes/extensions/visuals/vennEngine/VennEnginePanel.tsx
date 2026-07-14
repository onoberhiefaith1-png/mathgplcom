// Right-side property panel for the Universal Venn Engine.

import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { UCEVennModel, VennSet, SetLayout, SetId, RegionOverride } from "./types";
import { LAYOUT_LABEL, defaultSet } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  model: UCEVennModel;
  selectedRegion: string | null;
  selectedSet: string | null;
  onSelectSet: (id: string | null) => void;
  onSelectRegion: (k: string | null) => void;
  onChange: (m: UCEVennModel) => void;
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

export function VennEnginePanel({ open, onClose, model, selectedRegion, selectedSet, onSelectSet, onSelectRegion, onChange, onDeleteDiagram }: Props) {
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
    <button type="button" onClick={() => setExpanded((v) => !v)}
      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted/60"
      title={expanded ? "Fold settings" : "Show settings"}
      aria-label={expanded ? "Fold settings" : "Show settings"}>
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
        <h2 className="text-sm font-semibold">Venn diagram</h2>
        <div className="flex items-center gap-2">
          {foldButton}
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close ✕</button>
        </div>
      </header>

      {onDeleteDiagram && (
        <div className="px-4 py-2 border-b border-border">
          <button onClick={() => { onDeleteDiagram(); onClose(); }}
            className="w-full text-[11px] text-destructive hover:bg-destructive/10 rounded px-2 py-1.5 border border-destructive/30">
            🗑 Delete entire diagram
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6 text-xs">
        <Body
          model={model} onChange={onChange}
          selectedRegion={selectedRegion} selectedSet={selectedSet}
          onSelectSet={onSelectSet} onSelectRegion={onSelectRegion}
        />
      </div>
    </div>,
    document.body,
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
    <input type="number" step={step} min={min}
      defaultValue={Number(value.toFixed(2))} key={value}
      onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onCommit(n); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="input-panel w-full text-right" />
  );
}

function Body({ model, onChange, selectedRegion, selectedSet, onSelectSet, onSelectRegion }: {
  model: UCEVennModel;
  onChange: (m: UCEVennModel) => void;
  selectedRegion: string | null;
  selectedSet: string | null;
  onSelectSet: (id: string | null) => void;
  onSelectRegion: (k: string | null) => void;
}) {
  const setModel = (patch: Partial<UCEVennModel>) => onChange({ ...model, ...patch });
  const setSet = (id: SetId, patch: Partial<VennSet>) => {
    onChange({ ...model, sets: model.sets.map((s) => s.id === id ? { ...s, ...patch } : s) });
  };
  const setRegion = (key: string, patch: Partial<RegionOverride>) => {
    const existing = model.regions.find((r) => r.key === key);
    let regions: RegionOverride[];
    if (existing) {
      regions = model.regions.map((r) => r.key === key ? { ...r, ...patch } : r);
    } else {
      regions = [...model.regions, { key, text: "", fill: "none", fillOpacity: 0.3, ...patch }];
    }
    onChange({ ...model, regions });
  };

  const setNumSets = (n: 2 | 3) => {
    if (n === model.numSets) return;
    if (n === 3 && !model.sets.find((s) => s.id === "C")) {
      const C = defaultSet("C", model.width / 2, model.height / 2 - 30, "#22c55e");
      onChange({ ...model, numSets: 3, sets: [...model.sets, C], layout: model.layout === "twoIntersect" ? "threeAll" : model.layout === "twoDisjoint" ? "threeAllDisjoint" : model.layout });
    } else if (n === 2) {
      onChange({ ...model, numSets: 2, sets: model.sets.filter((s) => s.id !== "C"), layout: model.layout.startsWith("three") || model.layout === "custom" ? "twoIntersect" : model.layout });
    }
  };

  const region = selectedRegion ? (model.regions.find((r) => r.key === selectedRegion) ?? { key: selectedRegion, text: "", fill: "none", fillOpacity: 0.3 }) : null;
  const setObj = selectedSet ? model.sets.find((s) => s.id === selectedSet) : null;

  return (
    <>
      <Header>Layout</Header>
      <Row label="Number of sets">
        <select className="input-panel w-full" value={model.numSets}
          onChange={(e) => setNumSets(Number(e.target.value) as 2 | 3)}>
          <option value={2}>Two sets</option>
          <option value={3}>Three sets</option>
        </select>
      </Row>
      <Row label="Layout">
        <select className="input-panel w-full" value={model.layout}
          onChange={(e) => setModel({ layout: e.target.value as SetLayout })}>
          {(model.numSets === 2
            ? (["twoIntersect", "twoDisjoint", "custom"] as SetLayout[])
            : (["threeAll", "threeOneDisjoint", "threeChain", "threeAllDisjoint", "custom"] as SetLayout[])
          ).map((l) => <option key={l} value={l}>{LAYOUT_LABEL[l]}</option>)}
        </select>
      </Row>

      {model.layout === "custom" && (
        <>
          <Header>Relationships</Header>
          <Row label="A ↔ B">
            <input type="checkbox" checked={model.relations.AB}
              onChange={(e) => setModel({ relations: { ...model.relations, AB: e.target.checked } })} />
          </Row>
          {model.numSets === 3 && (
            <>
              <Row label="A ↔ C">
                <input type="checkbox" checked={model.relations.AC}
                  onChange={(e) => setModel({ relations: { ...model.relations, AC: e.target.checked } })} />
              </Row>
              <Row label="B ↔ C">
                <input type="checkbox" checked={model.relations.BC}
                  onChange={(e) => setModel({ relations: { ...model.relations, BC: e.target.checked } })} />
              </Row>
            </>
          )}
        </>
      )}

      <Header>Sets</Header>
      <div className="flex gap-1 pb-1">
        {model.sets.map((s) => (
          <button key={s.id}
            className={`btn-panel flex-1 text-[11px] ${selectedSet === s.id ? "border-primary" : ""}`}
            onClick={() => { onSelectSet(s.id); onSelectRegion(null); }}>
            {s.label || s.id}
          </button>
        ))}
      </div>
      {setObj && (
        <>
          <Row label="Label">
            <input className="input-panel w-full text-right" defaultValue={setObj.label}
              key={setObj.label} onBlur={(e) => setSet(setObj.id, { label: e.target.value })} />
          </Row>
          <Row label="Radius">
            <input type="range" min={20} max={100} step={1} value={setObj.radius}
              onChange={(e) => setSet(setObj.id, { radius: Number(e.target.value) })} className="w-full" />
          </Row>
          <Row label="Border thickness">
            <input type="range" min={1} max={6} step={0.5} value={setObj.thickness}
              onChange={(e) => setSet(setObj.id, { thickness: Number(e.target.value) })} className="w-full" />
          </Row>
          <Row label="Border colour">
            <select className="input-panel w-full"
              value={COLORS.some((c) => c.value === setObj.colour) ? setObj.colour : "#111827"}
              onChange={(e) => setSet(setObj.id, { colour: e.target.value })}>
              {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Row>
          <Row label="Fill">
            <select className="input-panel w-full"
              value={setObj.fill}
              onChange={(e) => setSet(setObj.id, { fill: e.target.value })}>
              <option value="none">No fill</option>
              {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Row>
          {setObj.fill !== "none" && (
            <Row label="Fill opacity">
              <input type="range" min={0} max={1} step={0.05} value={setObj.fillOpacity}
                onChange={(e) => setSet(setObj.id, { fillOpacity: Number(e.target.value) })} className="w-full" />
            </Row>
          )}
          <Row label="Visible">
            <input type="checkbox" checked={setObj.visible}
              onChange={(e) => setSet(setObj.id, { visible: e.target.checked })} />
          </Row>
          {setObj.manualPlacement && (
            <button className="btn-panel w-full text-[11px] mt-1"
              onClick={() => setSet(setObj.id, { manualPlacement: false })}>
              Reset position (auto-layout)
            </button>
          )}
        </>
      )}

      <Header>Universal set</Header>
      <Row label="Show">
        <input type="checkbox" checked={model.universe.show}
          onChange={(e) => setModel({ universe: { ...model.universe, show: e.target.checked } })} />
      </Row>
      {model.universe.show && (
        <>
          <Row label="Padding">
            <NumInput value={model.universe.padding} min={0} onCommit={(v) => setModel({ universe: { ...model.universe, padding: v } })} />
          </Row>
          <Row label="Border">
            <input type="range" min={0} max={4} step={0.5} value={model.universe.border}
              onChange={(e) => setModel({ universe: { ...model.universe, border: Number(e.target.value) } })} className="w-full" />
          </Row>
          <Row label="Border colour">
            <select className="input-panel w-full" value={model.universe.borderColour}
              onChange={(e) => setModel({ universe: { ...model.universe, borderColour: e.target.value } })}>
              {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Row>
          <Row label="Background">
            <select className="input-panel w-full" value={model.universe.background}
              onChange={(e) => setModel({ universe: { ...model.universe, background: e.target.value } })}>
              <option value="none">None</option>
              {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Row>
        </>
      )}

      <Header>Region</Header>
      {region ? (
        <>
          <p className="text-[11px] text-muted-foreground pb-1">
            Editing region <strong>{formatRegion(region.key)}</strong>
          </p>
          <Row label="Text">
            <input className="input-panel w-full text-right"
              defaultValue={region.text} key={region.text}
              placeholder="e.g. n(A∩B) = 12"
              onBlur={(e) => setRegion(region.key, { text: e.target.value })} />
          </Row>
          <Row label="Shade">
            <select className="input-panel w-full" value={region.fill}
              onChange={(e) => setRegion(region.key, { fill: e.target.value })}>
              <option value="none">None</option>
              {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Row>
          {region.fill !== "none" && (
            <Row label="Opacity">
              <input type="range" min={0} max={1} step={0.05} value={region.fillOpacity}
                onChange={(e) => setRegion(region.key, { fillOpacity: Number(e.target.value) })} className="w-full" />
            </Row>
          )}
          <button className="btn-panel w-full text-[11px] mt-1 text-destructive"
            onClick={() => onChange({ ...model, regions: model.regions.filter((r) => r.key !== region.key) })}>
            Clear region override
          </button>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground pb-1">
          Click any region on the diagram to shade or label it.
        </p>
      )}
    </>
  );
}

function formatRegion(key: string): string {
  if (!key) return "outside";
  if (key.length === 1) return `${key} only`;
  return key.split("").join(" ∩ ");
}
