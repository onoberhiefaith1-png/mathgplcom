// Per-component section renderers. Each function receives the current
// component + a patch callback and renders a small block of form controls.
// The PropertyPanel picks which sections to render based on component kind.

import type { Component } from "./componentModel";
import type { Adapter } from "../shapes";
import type { Nodes } from "../geometry";
import { dist } from "../geometry";

interface Ctx {
  component: Component;
  onPatch: (patch: Partial<Component>) => void;
  adapter?: Adapter | null;
  nodes?: Nodes | null;
  onPatchAttrs?: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}

const COLORS = [
  { value: "currentColor", label: "Default" },
  { value: "#ef4444", label: "Red" },
  { value: "#f59e0b", label: "Orange" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#111827", label: "Black" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex-1 text-[11px]">{label}</span>
      <div className="w-40 flex justify-end">{children}</div>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1">{children}</div>;
}

// ── Identity ────────────────────────────────────────────────────────────
export function IdentitySection({ component, onDelete }: Ctx) {
  return (
    <div>
      <Header>Identity</Header>
      <Row label="Kind">
        <span className="text-muted-foreground">{component.kind}</span>
      </Row>
      <Row label="ID">
        <span className="text-muted-foreground truncate max-w-[10rem]">{component.id}</span>
      </Row>
      <div className="pt-2">
        <button
          onClick={onDelete}
          className="btn-panel w-full text-destructive"
        >Delete component</button>
      </div>
    </div>
  );
}

// ── Appearance ──────────────────────────────────────────────────────────
export function AppearanceSection({ component, onPatch }: Ctx) {
  const ap = component.appearance ?? {};
  return (
    <div>
      <Header>Appearance</Header>
      <Row label="Colour">
        <select className="input-panel w-full" value={ap.color ?? "currentColor"}
          onChange={(e) => onPatch({ appearance: { ...ap, color: e.target.value } })}>
          {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Row>
      <Row label="Opacity">
        <input type="range" min={0.1} max={1} step={0.05}
          value={ap.opacity ?? 1}
          onChange={(e) => onPatch({ appearance: { ...ap, opacity: Number(e.target.value) } })}
          className="w-full" />
      </Row>
    </div>
  );
}

// ── Line ────────────────────────────────────────────────────────────────
export function LineSection({ component, onPatch, adapter, nodes, onPatchAttrs }: Ctx) {
  const ap = component.appearance ?? {};
  const [aName, bName] = component.nodes ?? [];
  const a = nodes && aName ? nodes[aName] : null;
  const b = nodes && bName ? nodes[bName] : null;
  const length = a && b ? dist(a, b) / 10 : null;

  const setLength = (raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || !a || !b || !nodes || !onPatchAttrs) return;

    const sideName = `${aName}${bName}`;
    const reversedName = `${bName}${aName}`;
    const primary = adapter?.setMeasure?.(sideName, value, nodes);
    const measured = primary && !("error" in primary)
      ? primary
      : adapter?.setMeasure?.(reversedName, value, nodes);
    if (measured && !("error" in measured)) {
      onPatchAttrs({ nodes: measured });
      return;
    }

    const current = dist(a, b) || 1;
    const scale = (value * 10) / current;
    onPatchAttrs({
      nodes: {
        ...nodes,
        [bName]: {
          x: a.x + (b.x - a.x) * scale,
          y: a.y + (b.y - a.y) * scale,
        },
      },
    });
  };

  return (
    <div>
      <Header>Line</Header>
      {length != null && (
        <Row label="Length">
          <input
            type="number"
            min={0.1}
            step={0.1}
            className="input-panel w-full text-right"
            value={length.toFixed(1)}
            onChange={(e) => setLength(e.target.value)}
          />
        </Row>
      )}
      <Row label="Thickness">
        <input type="range" min={1} max={6} step={0.5}
          value={ap.thickness ?? 2}
          onChange={(e) => onPatch({ appearance: { ...ap, thickness: Number(e.target.value) } })}
          className="w-full" />
      </Row>
      <Row label="Style">
        <select className="input-panel w-full" value={ap.dash ?? "solid"}
          onChange={(e) => onPatch({ appearance: { ...ap, dash: e.target.value as any } })}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </Row>
      <Row label="Value label">
        <input className="input-panel w-full text-right"
          placeholder="auto"
          value={component.content?.value ?? ""}
          onChange={(e) => onPatch({ content: { ...component.content, value: e.target.value } })} />
      </Row>
    </div>
  );
}

// ── Vertex ──────────────────────────────────────────────────────────────
export function VertexSection({ component, onPatch }: Ctx) {
  return (
    <div>
      <Header>Vertex</Header>
      <Row label="Name">
        <input className="input-panel w-full text-right"
          value={component.content?.label ?? ""}
          onChange={(e) => onPatch({ content: { ...component.content, label: e.target.value } })} />
      </Row>
    </div>
  );
}

// ── Angle ───────────────────────────────────────────────────────────────
export function AngleSection({ component, onPatch }: Ctx) {
  const pos = component.content?.labelPosition ?? "inside";
  return (
    <div>
      <Header>Angle</Header>
      <Row label="Label position">
        <select className="input-panel w-full" value={pos}
          onChange={(e) => onPatch({ content: { ...component.content, labelPosition: e.target.value as any } })}>
          {["inside", "outside", "above", "below", "left", "right", "free"].map(p => (
            <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </Row>
      <Row label="Custom label">
        <input className="input-panel w-full text-right"
          placeholder="e.g. 60°"
          value={component.content?.label ?? ""}
          onChange={(e) => onPatch({ content: { ...component.content, label: e.target.value } })} />
      </Row>
    </div>
  );
}

// ── Label / Text ────────────────────────────────────────────────────────
export function LabelSection({ component, onPatch }: Ctx) {
  const style = component.content?.labelStyle ?? {};
  const patchStyle = (patch: Partial<NonNullable<typeof style>>) =>
    onPatch({ content: { ...component.content, labelStyle: { ...style, ...patch } } });
  return (
    <div>
      <Header>Label</Header>
      <Row label="Text">
        <input className="input-panel w-full text-right"
          value={component.content?.label ?? ""}
          onChange={(e) => onPatch({ content: { ...component.content, label: e.target.value } })} />
      </Row>
      <Row label="Font size">
        <select className="input-panel w-full"
          value={style.sizePx ?? "auto"}
          onChange={(e) => patchStyle({ sizePx: e.target.value === "auto" ? undefined : Number(e.target.value) })}>
          <option value="auto">Auto</option>
          {[10, 12, 14, 16, 18, 22].map(n => <option key={n} value={n}>{n} px</option>)}
        </select>
      </Row>
      <Row label="Weight">
        <select className="input-panel w-full"
          value={style.weight ?? "auto"}
          onChange={(e) => patchStyle({ weight: e.target.value === "auto" ? undefined : (e.target.value as "normal" | "bold") })}>
          <option value="auto">Auto</option>
          <option value="normal">Regular</option>
          <option value="bold">Bold</option>
        </select>
      </Row>
      <Row label="Colour">
        <select className="input-panel w-full"
          value={style.color ?? "auto"}
          onChange={(e) => patchStyle({ color: e.target.value === "auto" ? undefined : e.target.value })}>
          <option value="auto">Auto</option>
          {COLORS.filter(c => c.value !== "currentColor").map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </Row>
      <Row label="Position">
        <select className="input-panel w-full"
          value={style.position ?? "auto"}
          onChange={(e) => patchStyle({ position: e.target.value === "auto" ? undefined : (e.target.value as any) })}>
          {["auto", "above", "below", "left", "right", "inside", "outside"].map(p => (
            <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </Row>
      <Row label="Offset">
        <input type="range" min={0} max={24} step={1}
          value={style.offsetPx ?? 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            patchStyle({ offsetPx: n === 0 ? undefined : n });
          }}
          className="w-full" />
      </Row>
    </div>
  );
}


// ── Measurement ─────────────────────────────────────────────────────────
export function MeasurementSection({ component, onPatch }: Ctx) {
  return (
    <div>
      <Header>Measurement</Header>
      <Row label="Value">
        <input className="input-panel w-full text-right"
          value={component.content?.value ?? ""}
          placeholder="auto"
          onChange={(e) => onPatch({ content: { ...component.content, value: e.target.value } })} />
      </Row>
      <Row label="Unit">
        <select className="input-panel w-full"
          value={component.content?.unit ?? "cm"}
          onChange={(e) => onPatch({ content: { ...component.content, unit: e.target.value } })}>
          {["cm", "mm", "m", "km", "°", ""].map(u => <option key={u} value={u}>{u || "none"}</option>)}
        </select>
      </Row>
    </div>
  );
}

// ── Fill ────────────────────────────────────────────────────────────────
export function FillSection({ component, onPatch }: Ctx) {
  const ap = component.appearance ?? {};
  return (
    <div>
      <Header>Fill</Header>
      <Row label="Colour">
        <select className="input-panel w-full" value={ap.fill ?? "transparent"}
          onChange={(e) => onPatch({ appearance: { ...ap, fill: e.target.value } })}>
          <option value="transparent">None</option>
          {COLORS.filter(c => c.value !== "currentColor").map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </Row>
      <Row label="Opacity">
        <input type="range" min={0.1} max={1} step={0.05}
          value={ap.opacity ?? 0.3}
          onChange={(e) => onPatch({ appearance: { ...ap, opacity: Number(e.target.value) } })}
          className="w-full" />
      </Row>
    </div>
  );
}

// ── Behaviour ───────────────────────────────────────────────────────────
export function BehaviourSection({ component, onPatch }: Ctx) {
  const b = component.behaviour ?? {};
  return (
    <div>
      <Header>Behaviour</Header>
      <Row label="Visible">
        <input type="checkbox" checked={b.visible !== false}
          onChange={(e) => onPatch({ behaviour: { ...b, visible: e.target.checked } })} />
      </Row>
      <Row label="Locked">
        <input type="checkbox" checked={!!b.locked}
          onChange={(e) => onPatch({ behaviour: { ...b, locked: e.target.checked } })} />
      </Row>
    </div>
  );
}
