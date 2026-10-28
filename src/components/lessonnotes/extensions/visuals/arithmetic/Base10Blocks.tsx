// Base-10 Blocks — auto-generate ones/tens/hundreds/thousands from a
// number the teacher enters in the Properties Panel. Opens empty (no
// preset value); nothing renders until the teacher enters a number.

import { useCallback, useMemo } from "react";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import {
  PanelGroup, PanelRow, PanelToggle, PanelText,
} from "@/components/lessonnotes/panel/panelPrimitives";

interface Attrs {
  value?: string;
  showLabels?: boolean;
  stack?: boolean;
  animateRegroup?: boolean;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

function normalize(a: Record<string, unknown>): Required<Attrs> {
  return {
    value: typeof a.value === "string" ? a.value : "",
    showLabels: a.showLabels === undefined ? true : Boolean(a.showLabels),
    stack: a.stack === undefined ? false : Boolean(a.stack),
    animateRegroup: Boolean(a.animateRegroup),
  };
}

function digitsOf(value: string) {
  if (!value) return { thousands: 0, hundreds: 0, tens: 0, ones: 0, total: 0, empty: true };
  const n = Math.max(0, Math.min(9999, parseInt(value, 10) || 0));
  return {
    thousands: Math.floor(n / 1000) % 10,
    hundreds: Math.floor(n / 100) % 10,
    tens: Math.floor(n / 10) % 10,
    ones: n % 10,
    total: n,
    empty: false,
  };
}

export function Base10Blocks({ attrs, onChange, selected }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);
  const d = digitsOf(m.value);

  const editor = (
    <div>
      <PanelGroup label="Number">
        <PanelRow label="Value (0–9999)">
          <PanelText value={m.value} onChange={(v) => patch({ value: v.replace(/[^\d]/g, "") })} placeholder="" />
        </PanelRow>
        {!d.empty && (
          <div className="text-[10px] text-foreground/60">
            {d.thousands} Th · {d.hundreds} H · {d.tens} T · {d.ones} U
          </div>
        )}
      </PanelGroup>
      <PanelGroup label="Appearance">
        <PanelRow label="Show labels"><PanelToggle value={m.showLabels} onChange={(v) => patch({ showLabels: v })} /></PanelRow>
        <PanelRow label="Stack mode"><PanelToggle value={m.stack} onChange={(v) => patch({ stack: v })} /></PanelRow>
        <PanelRow label="Animate regrouping"><PanelToggle value={m.animateRegroup} onChange={(v) => patch({ animateRegroup: v })} /></PanelRow>
      </PanelGroup>
    </div>
  );
  useRegisterAssetEditor(!!selected, "base10Blocks", "Base-10 blocks", editor);

  if (d.empty) {
    return (
      <div className="not-prose inline-block" style={{ color: "#0f172a" }}>
        {selected && (
          <div className="text-xs italic text-foreground/50 px-2 py-3 border border-dashed border-foreground/30 rounded">
            Enter a number in the settings panel to generate blocks.
          </div>
        )}
      </div>
    );
  }

  const Slot = ({ label, count, kind }: {
    label: string; count: number; kind: "one" | "ten" | "hundred" | "thousand";
  }) => {
    if (count === 0) return null;
    return (
      <div className="flex flex-col items-center gap-1">
        {m.showLabels && (
          <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#0f172a" }}>{label}</div>
        )}
        <div className={"min-h-[64px] flex items-end justify-center gap-1 max-w-[140px] " + (m.stack ? "flex-col-reverse" : "flex-wrap")}>
          {Array.from({ length: count }).map((_, i) => <Block key={i} kind={kind} />)}
        </div>
        {m.showLabels && (
          <div className="text-[12px] tabular-nums font-semibold" style={{ color: "#0f172a" }}>{count}</div>
        )}
      </div>
    );
  };

  return (
    <div className="not-prose inline-block" style={{ color: "#0f172a" }}>
      <div className="flex items-end gap-4">
        <Slot label="Thousands" count={d.thousands} kind="thousand" />
        <Slot label="Hundreds"  count={d.hundreds}  kind="hundred" />
        <Slot label="Tens"      count={d.tens}      kind="ten" />
        <Slot label="Ones"      count={d.ones}      kind="one" />
      </div>
    </div>
  );
}

function Block({ kind }: { kind: "one" | "ten" | "hundred" | "thousand" }) {
  const s = "#0f172a";
  if (kind === "one") {
    return (
      <svg width={14} height={14} viewBox="0 0 10 10"><rect x={0.5} y={0.5} width={9} height={9} stroke={s} fill="none" strokeWidth={1.4} /></svg>
    );
  }
  if (kind === "ten") {
    return (
      <svg width={14} height={70} viewBox="0 0 10 100">
        <rect x={0.5} y={0.5} width={9} height={99} stroke={s} fill="none" strokeWidth={1.4} />
        {Array.from({ length: 9 }).map((_, i) => <line key={i} x1={0.5} y1={(i + 1) * 10} x2={9.5} y2={(i + 1) * 10} stroke={s} strokeWidth={0.7} />)}
      </svg>
    );
  }
  if (kind === "hundred") {
    return (
      <svg width={44} height={44} viewBox="0 0 100 100">
        <rect x={0.5} y={0.5} width={99} height={99} stroke={s} fill="none" strokeWidth={1.4} />
        {Array.from({ length: 9 }).map((_, i) => <line key={"v" + i} x1={(i + 1) * 10} y1={0.5} x2={(i + 1) * 10} y2={99.5} stroke={s} strokeWidth={0.7} />)}
        {Array.from({ length: 9 }).map((_, i) => <line key={"h" + i} x1={0.5} y1={(i + 1) * 10} x2={99.5} y2={(i + 1) * 10} stroke={s} strokeWidth={0.7} />)}
      </svg>
    );
  }
  return (
    <svg width={58} height={58} viewBox="0 0 100 100">
      <path d="M10 30 H70 V90 H10 Z" stroke={s} fill="none" strokeWidth={2} />
      <path d="M10 30 L30 10 H90 L70 30" stroke={s} fill="none" strokeWidth={2} />
      <path d="M70 90 L90 70 V10" stroke={s} fill="none" strokeWidth={2} />
    </svg>
  );
}

export default Base10Blocks;
