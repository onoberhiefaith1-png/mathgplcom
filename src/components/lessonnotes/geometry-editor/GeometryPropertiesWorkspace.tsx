// GeometryPropertiesWorkspace — the dedicated authoring workspace.
//
// It is NOT a second diagram: it mounts the very same GeometryScene in the
// existing GeometryWorkbench, and simply replaces the right-hand panel with
// the Geometry Properties authoring panel. Everything the teacher draws or
// edits here is the same diagram that lives in the lesson note.

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { GeoId, GeometryScene } from "@/lib/geometry/scene";
import { GeometryWorkbench } from "./GeometryWorkbench";
import { GeometryPropertiesPanel } from "./GeometryPropertiesPanel";
import { readProperties, writeProperties } from "@/lib/geometry/properties/model";

interface Props {
  scene: GeometryScene;
  onChange: (next: GeometryScene) => void;
  onClose: () => void;
}

export function GeometryPropertiesWorkspace({ scene, onChange, onClose }: Props) {
  const [highlightIds, setHighlightIds] = useState<GeoId[]>([]);
  const [connecting, setConnecting] = useState(false);
  const doc = readProperties(scene);

  const body = (
    <div className="fixed inset-0 z-[95] flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-foreground/10 px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Geometry Properties</h2>
          <p className="text-[11px] text-foreground/55">
            The diagram is the map — click any object to author its relationships.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded border border-foreground/20 px-2.5 py-1 text-[12px] hover:bg-foreground/5"
        >
          <X className="h-3.5 w-3.5" /> Close
        </button>
      </header>

      <div className="min-h-0 flex-1">
        <GeometryWorkbench
          scene={scene}
          onChange={onChange}
          className="h-full"
          highlightIds={highlightIds}
          rightPanelTitle="Geometry Properties"
          rightPanelWidthClass="w-80"
          renderRightPanel={(editor) => (
            <GeometryPropertiesPanel
              scene={editor.scene}
              doc={readProperties(editor.scene)}
              onDocChange={(next) => editor.commit(writeProperties(editor.scene, next))}
              targetId={editor.selectedIds[0] ?? null}
              onHighlight={setHighlightIds}
              connecting={connecting}
              setConnecting={setConnecting}
            />
          )}
        />
      </div>

      <footer className="border-t border-foreground/10 px-4 py-1.5 text-[11px] text-foreground/55">
        {doc.published
          ? `Guide published to students — showing ${doc.access === "both" ? "specific and general" : doc.access}.`
          : "Guide is not published — students see the diagram only."}
      </footer>
    </div>
  );

  return typeof document === "undefined" ? body : createPortal(body, document.body);
}

export default GeometryPropertiesWorkspace;
