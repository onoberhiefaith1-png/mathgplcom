// GeometryPropertiesWorkspace — the dedicated authoring workspace.
//
// It is NOT a second diagram: it mounts the very same GeometryScene in the
// existing GeometryWorkbench, and simply replaces the right-hand panel with
// the Geometry Properties authoring panel. Everything the teacher draws or
// edits here is the same diagram that lives in the lesson note.

import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import type { GeoId, GeometryScene } from "@/lib/geometry/scene";
import { GeometryWorkbench } from "./GeometryWorkbench";
import { GeometryPropertiesPanel } from "./GeometryPropertiesPanel";
import { describeObject, readProperties, writeProperties } from "@/lib/geometry/properties/model";

interface Props {
  scene: GeometryScene;
  onChange: (next: GeometryScene) => void;
  onClose: () => void;
}

export function GeometryPropertiesWorkspace({ scene, onChange, onClose }: Props) {
  const [highlightIds, setHighlightIds] = useState<GeoId[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [targetName, setTargetName] = useState<string | null>(null);
  const doc = readProperties(scene);

  const body = (
    <div className="fixed inset-0 z-[95] flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-foreground/10 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-md border border-foreground/20 px-2.5 py-1.5 text-[12px] font-medium hover:bg-foreground/5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Lesson Note
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight">
            Geometry Relationships
            {targetName ? <span className="font-normal text-foreground/60"> · {targetName}</span> : null}
          </h2>
          <p className="text-[11px] text-foreground/55">
            The diagram is the map — click any object to author its relationships.
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <GeometryWorkbench
          scene={scene}
          onChange={onChange}
          className="h-full"
          highlightIds={highlightIds}
          rightPanelTitle="Geometry Properties"
          rightPanelWidthClass="w-80"
          renderRightPanel={(editor) => {
            const first = editor.selectedIds[0] ?? null;
            const info = first ? describeObject(editor.scene, first) : null;
            const name = info ? `${info.typeLabel} ${info.name}` : null;
            if (name !== targetName) setTargetName(name);
            return (
              <GeometryPropertiesPanel
                scene={editor.scene}
                doc={readProperties(editor.scene)}
                onDocChange={(next) => editor.commit(writeProperties(editor.scene, next))}
                targetId={first}
                onHighlight={setHighlightIds}
                connecting={connecting}
                setConnecting={setConnecting}
              />
            );
          }}
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
