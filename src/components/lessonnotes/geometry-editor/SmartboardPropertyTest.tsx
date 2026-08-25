// SmartboardPropertyTest — the TEACHER Smartboard test for one diagram.
//
// It is a teacher-only rehearsal: a pure white board carrying the exact,
// complete diagram object from the lesson note (never cropped, never
// reconstructed from text) plus the board's own Review Properties dock.
// Clicking a part lists the properties linked to that part by object
// identity; clicking a property lights up the parts it refers to.

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { ReviewPropertiesPanel } from "@/components/smartboard/ReviewPropertiesPanel";
import { DiagramZoomControl } from "./DiagramZoomControl";
import { useDiagramZoom } from "@/lib/geometry/useDiagramZoom";
import { itemObjectIds, type GeometryMapItem } from "@/lib/geometry/map/model";
import type { GeometryScene } from "@/lib/geometry/scene";

export function SmartboardPropertyTest({
  scene,
  onClose,
  zoomKey,
}: {
  scene: GeometryScene;
  onClose: () => void;
  /** Remembers this diagram's zoom between visits. */
  zoomKey?: string;
}) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const { zoom, setZoom } = useDiagramZoom(zoomKey ?? "property-test");

  const board = useMemo(
    () => (
      <GeometryDiagram
        scene={scene}
        large
        zoom={zoom}
        highlightIds={highlightIds}
        onPickObject={(id) => {
          setSelectedObjectId(id);
          setActiveId(null);
          setHighlightIds([id]);
        }}
      />
    ),
    [scene, highlightIds, zoom],
  );

  const pick = (item: GeometryMapItem | null) => {
    if (!item) {
      setActiveId(null);
      setHighlightIds(selectedObjectId ? [selectedObjectId] : []);
      return;
    }
    setActiveId(item.id);
    setHighlightIds(itemObjectIds(item));
  };

  return (
    <div className="fixed inset-0 z-[120] flex bg-white text-[#0f172a]">
      <div className="relative flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-white px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-black/15 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-black/5"
          >
            <X className="h-3.5 w-3.5" /> Close test
          </button>

          <DiagramZoomControl zoom={zoom} onZoom={setZoom} className="shrink-0" />

          <p className="text-[12.5px] font-semibold tracking-tight text-slate-900">
            Teacher Smartboard Test
            <span className="ml-2 font-normal text-slate-500">
              tap a part of the diagram
            </span>
          </p>
        </div>


        <div className="min-h-0 flex-1 overflow-auto bg-white p-6">
          <div className="mx-auto w-fit min-w-0 max-w-full bg-white">{board}</div>
        </div>

      </div>

      <div className="h-full w-[22%] min-w-[260px] bg-white">
        <ReviewPropertiesPanel
          scene={scene}
          role="teacher"
          selectedObjectId={selectedObjectId}
          activePropertyId={activeId}
          onPickProperty={pick}
          onClose={onClose}
          fg="#0f172a"
          bg="#ffffff"
          border="rgba(15,23,42,0.14)"
          accent="#2563eb"
        />
      </div>
    </div>
  );
}

export default SmartboardPropertyTest;
