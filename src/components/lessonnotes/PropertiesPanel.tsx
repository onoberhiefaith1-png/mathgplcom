// Universal right-hand Properties Panel. Renders the editor registered by
// the currently-selected asset via `useAssetSelection` / `useRegisterAssetEditor`.
// The panel has a visible vertical handle bar on its left edge that
// collapses/expands it. Once the teacher folds it, it stays folded until
// they open it again — selecting a new asset does not force it back open.

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useAssetSelection } from "@/hooks/useAssetSelection";
import { ChevronLeft, ChevronRight, Settings2, X } from "lucide-react";

export function PropertiesPanel() {
  const { reg } = useAssetSelection();
  const [expanded, setExpanded] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  // Only auto-expand the very first time a given asset id is selected.
  // Subsequent selections respect the teacher's fold state.
  useEffect(() => {
    if (!reg) return;
    if (!seenRef.current.has(reg.id)) {
      seenRef.current.add(reg.id);
      setExpanded(true);
    }
  }, [reg?.id]);

  // Broadcast panel width to the layout via a CSS variable so the
  // notebook column can reserve space instead of being overlapped.
  useEffect(() => {
    const root = document.documentElement;
    if (!reg) {
      root.style.setProperty("--properties-panel-width", "0px");
      return () => root.style.setProperty("--properties-panel-width", "0px");
    }
    if (expanded) {
      root.style.setProperty("--properties-panel-width", "clamp(240px, 20vw, 460px)");
    } else {
      root.style.setProperty("--properties-panel-width", "28px");
    }

    return () => root.style.setProperty("--properties-panel-width", "0px");
  }, [reg, expanded]);

  if (!reg || typeof document === "undefined") return null;

  const guardPanelEvent = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  if (!expanded) {
    return createPortal(
      <button
        type="button"
        onClick={() => setExpanded(true)}
        onMouseDown={guardPanelEvent}
        className="fixed inset-y-0 right-0 z-50 w-8 flex flex-col items-center justify-center gap-3 border-l border-border bg-background text-foreground shadow-lg hover:bg-muted/60"
        aria-label="Open settings"
        title="Open settings"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
          Settings
        </span>
        <Settings2 className="h-4 w-4" />
      </button>,
      document.body,
    );
  }

  return createPortal(
    <aside
      className="fixed inset-y-0 right-0 z-50 flex bg-background text-foreground shadow-2xl border-l border-border"
      style={{ width: "clamp(240px, 20vw, 460px)" }}
      aria-label="Asset properties panel"
      onMouseDown={guardPanelEvent}
      onPointerDown={guardPanelEvent}
      onClick={guardPanelEvent}
      onKeyDown={guardPanelEvent}
    >

      {/* Vertical drag/collapse handle on the left edge */}
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="w-6 shrink-0 flex flex-col items-center justify-center gap-2 border-r border-border bg-muted/40 hover:bg-muted text-foreground/70"
        aria-label="Collapse settings"
        title="Collapse settings"
      >
        <ChevronRight className="h-4 w-4" />
        <span className="text-[9px] font-semibold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
          Close
        </span>
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <div className="h-11 px-3 flex items-center justify-between gap-2 border-b border-border">
          <div className="min-w-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/80">
            <Settings2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{reg.title}</span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted/60 text-foreground/70"
            aria-label="Close settings"
            title="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3 text-sm text-foreground">
          {reg.editor}
        </div>
      </div>
    </aside>,
    document.body,
  );
}

export default PropertiesPanel;
