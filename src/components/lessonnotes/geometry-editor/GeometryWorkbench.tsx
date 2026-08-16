// GeometryWorkbench — the complete Lesson Note 2D diagram interface as one
// self-contained block: left tool panel | live drawing canvas | right
// diagram-tools + selection panel. Both side panels close independently.
//
// This is the SAME engine the lesson note uses (GeometryModeProvider,
// useGeometryEditor, GeometryCanvas, GeometryToolbox, DiagramToolsPanel,
// SelectionInspector) — nothing here is Smartboard-specific, so the board and
// the note behave identically.

import { useEffect, useMemo, useState } from "react";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import type { GeometryScene } from "@/lib/geometry/scene";
import { GeometryCanvas } from "./GeometryCanvas";
import { useGeometryEditor } from "./useGeometryEditor";
import { GeometryModeProvider, useGeometryMode } from "./GeometryModeContext";
import { GeometryToolbox } from "./GeometryToolbox";
import { DiagramToolsPanel } from "./DiagramToolsPanel";
import { SelectionInspector } from "./SelectionInspector";
import { cn } from "@/lib/utils";

interface Props {
  scene: GeometryScene;
  onChange: (next: GeometryScene) => void;
  onDeleteDiagram?: () => void;
  /** External history (e.g. the Smartboard's single undo/redo stack). */
  history?: { undo: () => void; redo: () => void };
  className?: string;
}

export function GeometryWorkbench(props: Props) {
  return (
    <GeometryModeProvider>
      <Workbench {...props} />
    </GeometryModeProvider>
  );
}

function Workbench({ scene, onChange, onDeleteDiagram, history, className }: Props) {
  const editor = useGeometryEditor(scene, onChange);
  const { mode, setMode, tool } = useGeometryMode();
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

  const rightPanel = useMemo(() => (
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [editor.scene, editor.selectedObjects, editor.selectedIds, editor.selectionKind,
      editor.pendingIds.length, editor.canUndo, editor.canRedo, onDeleteDiagram]);

  return (
    <div className={cn("flex h-full w-full min-h-0 gap-1 p-1", className)}>
      {leftOpen ? (
        <GeometryToolbox inline onExit={() => setLeftOpen(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setLeftOpen(true)}
          className="h-7 w-7 shrink-0 self-start grid place-items-center rounded border border-foreground/15 text-foreground/60 hover:bg-foreground/10"
          title="Show the geometry tools"
          aria-label="Show the geometry tools"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="min-w-0 flex-1 overflow-auto rounded-md">
        <GeometryCanvas editor={editor} />
      </div>

      {rightOpen ? (
        <aside
          className="h-full w-56 shrink-0 overflow-y-auto rounded-lg border border-foreground/15 bg-background/95 p-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
              Diagram Tools
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
          className="h-7 w-7 shrink-0 self-start grid place-items-center rounded border border-foreground/15 text-foreground/60 hover:bg-foreground/10"
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
