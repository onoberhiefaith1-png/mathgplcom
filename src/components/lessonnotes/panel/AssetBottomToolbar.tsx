// Inline bottom toolbar rendered directly under an arithmetic asset while
// selected. Contains only the primitives teachers reach for constantly
// (Add Row/Column, Delete Row/Column, etc.). Advanced settings live in the
// right-hand Properties Panel.

import type { ReactNode } from "react";

export interface BottomAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}

export function AssetBottomToolbar({
  actions,
  visible = true,
}: {
  actions: BottomAction[];
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      className="not-prose mt-2 flex flex-wrap items-center justify-center gap-1.5"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          disabled={a.disabled}
          onClick={(e) => { e.stopPropagation(); a.onClick(); }}
          className={
            "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors " +
            (a.tone === "danger"
              ? "border-destructive/40 bg-background text-destructive hover:bg-destructive/10"
              : "border-foreground/25 bg-background text-foreground hover:bg-foreground/5") +
            (a.disabled ? " opacity-40 cursor-not-allowed" : "")
          }
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default AssetBottomToolbar;
