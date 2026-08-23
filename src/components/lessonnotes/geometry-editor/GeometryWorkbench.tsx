// GeometryWorkbench — the complete Lesson Note 2D diagram interface as one
// self-contained block: left tool panel | live drawing canvas | right
// diagram-tools + selection panel. Both side panels close independently.
//
// This is the SAME engine the lesson note uses (GeometryModeProvider,
// useGeometryEditor, GeometryCanvas, GeometryToolbox, DiagramToolsPanel,
// SelectionInspector) — nothing here is Smartboard-specific, so the board and
// the note behave identically.

import { useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import type { GeometryScene } from "@/lib/geometry/scene";
import { GeometryCanvas } from "./GeometryCanvas";
import { useGeometryEditor } from "./useGeometryEditor";
import { GeometryModeProvider, useGeometryMode } from "./GeometryModeContext";
import { GeometryToolbox } from "./GeometryToolbox";
import { DiagramToolsPanel } from "./DiagramToolsPanel";
import { SelectionInspector } from "./SelectionInspector";
import { ResponsivePanel, useSheetPanels } from "@/components/ui/responsive-panel";
import { cn } from "@/lib/utils";


interface Props {
  scene: GeometryScene;
  onChange: (next: GeometryScene) => void;
  onDeleteDiagram?: () => void;
  /** External history (e.g. the Smartboard's single undo/redo stack). */
  history?: { undo: () => void; redo: () => void };
  className?: string;
  /** Default ink for the drawing (Smartboard passes its writing colour). */
  stroke?: string;
  /** Optional chrome colours so the side panels blend with the host surface. */
  chrome?: { bg: string; fg: string; border: string };
  /** Replaces the default Diagram Tools panel (Geometry Properties authoring). */
  renderRightPanel?: (editor: ReturnType<typeof useGeometryEditor>) => React.ReactNode;
  rightPanelTitle?: string;
  rightPanelWidthClass?: string;
  /** Authoring halo drawn over the diagram (never alters the diagram). */
  highlightIds?: string[];
  /** Objects a chosen relationship also involves — amber halo. */
  relatedIds?: string[];
  /** The relationship's own subject — emphasised halo. */
  emphasisIds?: string[];
  /** Hides the drawing toolbox — used by relationship authoring (select only). */
  hideLeftTools?: boolean;
}

export function GeometryWorkbench(props: Props) {
  return (
    <GeometryModeProvider>
      <Workbench {...props} />
    </GeometryModeProvider>
  );
}

function Workbench({ scene, onChange, onDeleteDiagram, history, className, stroke, chrome, renderRightPanel, rightPanelTitle, rightPanelWidthClass, highlightIds, relatedIds, emphasisIds, hideLeftTools }: Props) {
  const editor = useGeometryEditor(scene, onChange);
  const { mode, setMode, tool } = useGeometryMode();
  const phone = useSheetPanels();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);


  // The workbench is always in Geometry Mode — that is what makes the canvas
  // live and the tool panels visible.
  useEffect(() => { if (!mode) setMode(true); }, [mode, setMode]);

  // Tool broadcast from the left toolbox → this canvas.
  useEffect(() => {
    if (editor.tool !== tool) editor.setTool(tool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Ctrl/Cmd+Z / Shift+Z / Y — same shortcuts as the lesson note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        if (editor.canUndo) { e.preventDefault(); editor.doUndo(); }
        else if (history) { e.preventDefault(); history.undo(); }
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        if (editor.canRedo) { e.preventDefault(); editor.doRedo(); }
        else if (history) { e.preventDefault(); history.redo(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor.canUndo, editor.canRedo, editor.doUndo, editor.doRedo, history]);

  const rightPanel = useMemo(() => (renderRightPanel ? renderRightPanel(editor) : (
    <div className="space-y-2">
      <DiagramToolsPanel
        hasSelection={editor.selectedObjects.length > 0}
        pickCount={editor.pendingIds.length}
      />
      <SelectionInspector
        scene={editor.scene}
        selected={editor.selectedObjects}
        selectedIds={editor.selectedIds}
        kind={editor.selectionKind}
        onApply={(next) => editor.commit(next)}
        onSelect={(id, kind) => { editor.setSelectedIds([id]); editor.setSelectionKind(kind); }}
        onUndo={editor.doUndo}
        onRedo={editor.doRedo}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onDeleteDiagram={onDeleteDiagram}
      />
    </div>
  ))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [editor, editor.scene, editor.selectedObjects, editor.selectedIds, editor.selectionKind,
      editor.pendingIds.length, editor.canUndo, editor.canRedo, onDeleteDiagram, renderRightPanel]);

  // Measure the drawing area so the canvas is at least as large as the
  // workspace: the teacher can draw anywhere on it, not only inside a card.
  const [area, setArea] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const areaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setArea({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setArea({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Phones: both tool columns move into bottom sheets so the drawing canvas
  // gets the whole screen width. Desktop/tablet keep the pinned columns.
  if (phone) {
    return (
      <div className={cn("relative flex h-full w-full min-h-0 flex-col gap-1 p-1", className)}>
        <div className="flex shrink-0 items-center gap-2">
          {hideLeftTools ? null : (
            <button
              type="button"
              onClick={() => setLeftOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-foreground/15 px-3 text-xs font-semibold"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" /> Tools
            </button>
          )}
          <button
            type="button"
            onClick={() => setRightOpen(true)}
            className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-foreground/15 px-3 text-xs font-semibold"
          >
            <PanelRightOpen className="h-3.5 w-3.5" /> {rightPanelTitle ?? "Diagram Tools"}
          </button>
        </div>

        <div ref={areaRef} className="min-w-0 min-h-0 flex-1 overflow-auto overscroll-contain">
          <GeometryCanvas
            editor={editor}
            stroke={stroke}
            highlightIds={highlightIds}
            relatedIds={relatedIds}
            emphasisIds={emphasisIds}
            minViewW={Math.max(0, area.w - 8)}
            minViewH={Math.max(0, area.h - 8)}
          />
        </div>

        <ResponsivePanel title="Geometry tools" open={leftOpen} onOpenChange={setLeftOpen} heightClass="h-[60vh]">
          <GeometryToolbox inline onExit={() => setLeftOpen(false)} chrome={chrome} />
        </ResponsivePanel>
        <ResponsivePanel title={rightPanelTitle ?? "Diagram Tools"} open={rightOpen} onOpenChange={setRightOpen}>
          {rightPanel}
        </ResponsivePanel>
      </div>
    );
  }

  return (
    <div className={cn("relative flex h-full w-full min-h-0 gap-1 p-1", className)}>
      {hideLeftTools ? null : leftOpen ? (
        <div className="sticky left-0 top-0 z-20 h-full shrink-0 self-start">
          <GeometryToolbox inline onExit={() => setLeftOpen(false)} chrome={chrome} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLeftOpen(true)}
          className="sticky left-0 top-0 z-20 h-7 w-7 shrink-0 self-start grid place-items-center rounded border border-foreground/15 text-foreground/60 hover:bg-foreground/10"
          title="Show the geometry tools"
          aria-label="Show the geometry tools"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
      )}



      {/* Transparent drawing area — no surface of its own, scrolls vertically
          while the two tool panels stay pinned to the edges. */}
      <div ref={areaRef} className="min-w-0 min-h-0 flex-1 overflow-auto">
        <GeometryCanvas
          editor={editor}
          stroke={stroke}
          highlightIds={highlightIds}
          relatedIds={relatedIds}
          emphasisIds={emphasisIds}
          minViewW={Math.max(0, area.w - 8)}
          minViewH={Math.max(0, area.h - 8)}
        />
      </div>

      {rightOpen ? (
        <aside
          className={cn("sticky right-0 top-0 z-20 h-full shrink-0 self-start overflow-y-auto rounded-lg border border-foreground/15 bg-background/95 p-2", rightPanelWidthClass ?? "w-56")}
          style={chrome ? { background: chrome.bg, color: chrome.fg, borderColor: chrome.border } : undefined}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
              {rightPanelTitle ?? "Diagram Tools"}
            </span>
            <button
              type="button"
              onClick={() => setRightOpen(false)}
              className="rounded p-1 text-foreground/55 hover:bg-foreground/10"
              title="Hide the diagram tools"
              aria-label="Hide the diagram tools"
            >
              <PanelRightOpen className="h-3 w-3" />
            </button>
          </div>
          {rightPanel}
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setRightOpen(true)}
          className="sticky right-0 top-0 z-20 h-7 w-7 shrink-0 self-start grid place-items-center rounded border border-foreground/15 text-foreground/60 hover:bg-foreground/10"
          title="Show the diagram tools"
          aria-label="Show the diagram tools"
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default GeometryWorkbench;
