// GeometryEditorV2 — orchestrator for the rebuilt Geometry Diagram Editor.
//
// Layout:
//   [Left rail: 5 construction tools + Select]  [SVG Canvas]
//
// The right-hand editing surface is the app-wide Properties Panel; this
// component registers the current selection's editor via
// useRegisterAssetEditor so no floating popovers appear on the diagram.
//
// Phase 1: Point + Select only. Line/Circle/Arc/Curve are shown in the
// rail as disabled placeholders and will light up in later phases.

import { useMemo, useState } from "react";
import { LeftRailV2, type V2Tool } from "./LeftRailV2";
import { CanvasSVGV2 } from "./CanvasSVGV2";
import { PointPanel } from "./panels/PointPanel";
import {
  deleteObject,
  findPoint,
  updateObject,
  type V2Id,
  type V2Point,
  type V2Scene,
} from "@/lib/geometry/v2/scene";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";

interface Props {
  /** Stable id for this diagram instance (drives Properties Panel registration). */
  instanceId: string;
  scene: V2Scene;
  onChange: (next: V2Scene) => void;
  /** Whether this editor currently owns the right-hand panel. */
  active: boolean;
}

const RAIL_ENABLED: Partial<Record<V2Tool, boolean>> = {
  select: true,
  point: true,
  line: false,
  circle: false,
  arc: false,
  curve: false,
};

export function GeometryEditorV2({ instanceId, scene, onChange, active }: Props) {
  const [tool, setTool] = useState<V2Tool>("point");
  const [selectedId, setSelectedId] = useState<V2Id | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const selected = selectedId ? findPoint(scene, selectedId) : null;

  const editorNode = useMemo(() => {
    if (selected) {
      return (
        <PointPanel
          point={selected}
          onPatch={(patch) => onChange(updateObject(scene, selected.id, patch as Partial<V2Point>))}
          onDelete={() => {
            onChange(deleteObject(scene, selected.id));
            setSelectedId(null);
          }}
        />
      );
    }
    // Default panel content — canvas-level controls.
    return (
      <div className="flex flex-col gap-3">
        <div className="text-[11px] text-foreground/70">
          Pick a tool on the left, then click on the canvas.
          Select any object on the diagram to edit it here.
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Show hidden points
        </label>
      </div>
    );
  }, [selected, scene, onChange, showHidden]);

  const editorTitle = selected ? `Point ${selected.labelText || ""}`.trim() : "Geometry";

  useRegisterAssetEditor(active, `geometry-v2:${instanceId}`, editorTitle, editorNode);

  return (
    <div className="inline-flex items-start gap-2" onMouseDown={(e) => e.stopPropagation()}>
      <LeftRailV2 tool={tool} onChange={setTool} enabled={RAIL_ENABLED} />
      <CanvasSVGV2
        scene={scene}
        onChange={onChange}
        tool={tool}
        selectedId={selectedId}
        onSelect={setSelectedId}
        showHidden={showHidden}
      />
    </div>
  );
}
