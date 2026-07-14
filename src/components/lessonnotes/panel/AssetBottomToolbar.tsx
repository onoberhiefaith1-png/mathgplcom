// Inline bottom toolbar rendered directly under an arithmetic/tabular asset.
// Contains only the primitives teachers reach for constantly (Add Row/Column,
// Delete Row/Column, etc.). Advanced settings live in the right-hand
// Properties Panel.
//
// Visibility model: appears as soon as the pointer/sensor enters the asset,
// and auto-hides 10 s after the last activity. `visible` prop overrides
// (e.g. when the asset is selected the toolbar stays put).

import type { ReactNode } from "react";
import type { HoverIdleBind } from "@/hooks/useHoverIdleVisibility";

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
  bind,
}: {
  actions: BottomAction[];
  visible?: boolean;
  /** Optional hover-region bindings so hovering the toolbar itself keeps it alive. */
  bind?: HoverIdleBind;
}) {
  return (
    <div
      className="not-prose mt-2 flex flex-wrap items-center justify-center gap-1.5"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onPointerEnter={bind?.onPointerEnter}
      onPointerMove={bind?.onPointerMove}
      onPointerLeave={bind?.onPointerLeave}
      onPointerDown={bind?.onPointerDown}
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 180ms ease-out",
      }}
      aria-hidden={!visible}
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
