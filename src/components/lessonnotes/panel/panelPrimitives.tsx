// Small primitives used by every asset's Properties Panel editor. Keeps
// the panel looking uniform across every asset in the app.

import type { ReactNode } from "react";

export function PanelGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      {label && (
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-foreground/50">{label}</div>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function PanelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-foreground">
      <span className="text-foreground/70">{label}</span>
      <span className="flex items-center gap-1">{children}</span>
    </label>
  );
}

export function PanelButton({
  onClick, children, variant = "default", full = false,
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "danger";
  full?: boolean;
}) {
  const base = "inline-flex items-center justify-center gap-1 rounded border px-2 py-1 text-xs transition-colors";
  const style =
    variant === "danger"
      ? "border-destructive/50 text-destructive hover:bg-destructive/10"
      : "border-foreground/20 text-foreground hover:bg-foreground/5";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`${base} ${style} ${full ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}

export function PanelNumber({
  value, onChange, min, max, step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min} max={max} step={step}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-16 rounded border border-foreground/20 bg-background px-1.5 py-0.5 text-xs text-foreground text-right"
    />
  );
}

export function PanelColor({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      value={/^#/.test(value) ? value : "#3b82f6"}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className="h-5 w-8 cursor-pointer rounded border border-foreground/20 bg-transparent"
    />
  );
}

export function PanelToggle({
  value, onChange,
}: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(!value); }}
      className={
        "relative inline-flex h-4 w-7 items-center rounded-full transition-colors " +
        (value ? "bg-primary" : "bg-foreground/20")
      }
      aria-pressed={value}
    >
      <span
        className={
          "inline-block h-3 w-3 transform rounded-full bg-background transition-transform " +
          (value ? "translate-x-3.5" : "translate-x-0.5")
        }
      />
    </button>
  );
}

export function PanelText({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className="w-24 rounded border border-foreground/20 bg-background px-1.5 py-0.5 text-xs text-foreground"
    />
  );
}
