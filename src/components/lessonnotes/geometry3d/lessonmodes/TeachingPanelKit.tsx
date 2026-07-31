// Shared teaching-panel building blocks used by every Lesson Mode.

import { useState } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";
import type { Dimension, Working, VariableMeaning } from "@/lib/geometry3d/formulaLibrary";
import { UNITS, DECIMAL_OPTIONS, formatMeasure, formatValue } from "@/lib/geometry3d/units";

/* ---------------------------------- shell --------------------------------- */

export function PanelSection({
  title, children, defaultOpen = true,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
      >
        {title}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border p-2.5">{children}</div>}
    </div>
  );
}

/* ------------------------------ units & precision -------------------------- */

export function UnitControls({
  unit, setUnit, decimals, setDecimals,
}: { unit: string; setUnit: (u: string) => void; decimals: number; setDecimals: (n: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Unit
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        >
          {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Decimal places
        <select
          value={decimals}
          onChange={(e) => setDecimals(Number(e.target.value))}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        >
          {DECIMAL_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
    </div>
  );
}

/* ------------------------------ dimension editor --------------------------- */

export function DimensionEditor({
  dimensions, unit, decimals, onChange, onHover,
}: {
  dimensions: Dimension[];
  unit: string;
  decimals: number;
  /** Sets the raw param so the effective (scaled) dimension equals `value`. */
  onChange: (key: string, value: number) => void;
  onHover?: (guide: Dimension["guide"] | null) => void;
}) {
  if (!dimensions.length) {
    return <p className="text-[11px] text-muted-foreground">This solid has no editable dimensions.</p>;
  }
  return (
    <div className="space-y-2">
      {dimensions.map((d) => (
        <div
          key={d.key}
          className="rounded border border-border/70 p-1.5 hover:border-primary/60"
          onMouseEnter={() => onHover?.(d.guide)}
          onMouseLeave={() => onHover?.(null)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              <span className="mr-1 font-mono text-xs font-semibold text-foreground">{d.symbol}</span>
              {d.label}
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step={d.step}
                min={d.min}
                max={d.max}
                value={Number(formatValue(d.value, Math.max(decimals, 2)))}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) onChange(d.key, v);
                }}
                className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-right text-xs"
              />
              <span className="w-8 text-[10px] text-muted-foreground">
                {unit === "none" ? "" : unit}
              </span>
            </div>
          </div>
          <input
            type="range"
            min={d.min}
            max={d.max}
            step={d.step}
            value={d.value}
            onChange={(e) => onChange(d.key, Number(e.target.value))}
            className="mt-1 w-full accent-primary"
          />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- working block ---------------------------- */

export function WorkingBlock({
  working, unit, decimals, accent = "text-primary",
}: { working: Working; unit: string; decimals: number; accent?: string }) {
  return (
    <div className="space-y-1.5">
      {(working.steps ?? []).map((s, i) => (
        <Row key={i} label="Working" value={s} mono />
      ))}
      <Row label="Formula" value={working.formula} strong />
      <Row label="Substitution" value={working.substitution} mono />
      <Row label="Calculation" value={working.calculation} mono />
      <div className="flex items-baseline justify-between gap-2 rounded bg-muted/60 px-2 py-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Answer</span>
        <span className={`text-base font-bold ${accent}`}>
          {formatMeasure(working.value, unit, decimals, working.power)}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xs ${mono ? "font-mono" : ""} ${strong ? "text-sm font-semibold" : ""}`}>{value}</p>
    </div>
  );
}

/* ------------------------------- variable table ---------------------------- */

export function VariableTable({
  variables, unit, decimals,
}: { variables: VariableMeaning[]; unit: string; decimals: number }) {
  return (
    <div className="space-y-1.5">
      {variables.map((v) => (
        <div key={v.symbol} className="rounded border border-border/70 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px]">
              <span className="mr-1 font-mono text-xs font-semibold">{v.symbol}</span>
              <span className="text-muted-foreground">{v.label}</span>
            </span>
            <span className="text-xs font-medium">{formatMeasure(v.value, unit, decimals, 1)}</span>
          </div>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{v.meaning}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- teaching notes ---------------------------- */

export function TeachingNotes({
  why, how, notes, mistakes,
}: { why: string; how: string[]; notes: string[]; mistakes: string[] }) {
  return (
    <div className="space-y-2.5 text-[11px] leading-relaxed">
      {why && (
        <div>
          <p className="font-semibold text-foreground">Why the formula works</p>
          <p className="text-muted-foreground">{why}</p>
        </div>
      )}
      {how.length > 0 && (
        <div>
          <p className="font-semibold text-foreground">How to work it out</p>
          <ol className="ml-4 list-decimal text-muted-foreground">
            {how.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}
      {notes.length > 0 && (
        <div>
          <p className="font-semibold text-foreground">Teacher notes</p>
          <ul className="ml-4 list-disc text-muted-foreground">
            {notes.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {mistakes.length > 0 && (
        <div>
          <p className="font-semibold text-amber-500">Common mistakes</p>
          <ul className="ml-4 list-disc text-muted-foreground">
            {mistakes.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- copy button ------------------------------ */

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard unavailable */ }
      }}
      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] hover:bg-muted"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {done ? "Copied" : label}
    </button>
  );
}
