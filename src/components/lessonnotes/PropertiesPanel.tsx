// Universal right-hand Properties Panel. Renders the editor registered by
// the currently-selected asset via `useAssetSelection` / `useRegisterAssetEditor`.

import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useAssetSelection } from "@/hooks/useAssetSelection";
import { Settings2 } from "lucide-react";

export function PropertiesPanel() {
  const ctx = useAssetSelection();
  const reg = ctx?.reg ?? null;
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (reg) setExpanded(true);
  }, [reg?.id]);

  if (!reg || typeof document === "undefined") return null;

  const guardPanelEvent = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  const foldButton = (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted/60"
      title={expanded ? "Fold settings" : "Show settings"}
      aria-label={expanded ? "Fold settings" : "Show settings"}
    >
      {expanded ? "›" : <Settings2 className="h-4 w-4" />}
    </button>
  );

  if (!expanded) {
    return createPortal(
      <aside
        className="fixed inset-y-0 right-0 z-50 w-11 shadow-2xl border-l border-border overflow-hidden flex flex-col items-center bg-background text-foreground"
        aria-label="Asset properties panel"
        onMouseDown={guardPanelEvent}
        onPointerDown={guardPanelEvent}
        onClick={guardPanelEvent}
        onKeyDown={guardPanelEvent}
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
    <aside
      className="fixed inset-y-0 right-0 z-50 flex w-[min(360px,calc(100vw-48px))] flex-col overflow-hidden border-l border-border bg-background text-foreground shadow-2xl"
      aria-label="Asset properties panel"
      onMouseDown={guardPanelEvent}
      onPointerDown={guardPanelEvent}
      onClick={guardPanelEvent}
      onKeyDown={guardPanelEvent}
    >
      <div className="h-11 px-3 flex items-center justify-between gap-2 border-b border-border">
        <div className="min-w-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/80">
          <Settings2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{reg.title}</span>
        </div>
        {foldButton}
      </div>
      <div className="flex-1 overflow-auto p-3 text-sm text-foreground">
        {reg.editor}
      </div>
    </aside>,
    document.body,
  );
}

export default PropertiesPanel;
