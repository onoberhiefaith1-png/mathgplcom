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
import { itemObjectIds, type GeometryMapItem } from "@/lib/geometry/map/model";
import type { GeometryScene } from "@/lib/geometry/scene";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.5;
const ZOOM_STEP = 0.12;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

export function SmartboardPropertyTest({
  scene,
  onClose,
}: {
  scene: GeometryScene;
  onClose: () => void;
}) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const applyZoom = (next: number) => setZoom(clampZoom(next));


  const board = useMemo(
    () => (
      <GeometryDiagram
        scene={scene}
        large
        highlightIds={highlightIds}
        onPickObject={(id) => {
          setSelectedObjectId(id);
          setActiveId(null);
          setHighlightIds([id]);
        }}
      />
    ),
    [scene, highlightIds],
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

          <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-black/20 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => applyZoom(zoom - ZOOM_STEP)}
              className="px-3 py-1.5 text-base font-semibold leading-none text-slate-700 hover:bg-black/10"
              aria-label="Zoom out diagram"
              title="Zoom out"
            >−</button>
            <button
              type="button"
              onClick={() => applyZoom(1)}
              className="min-w-[46px] border-x border-black/10 px-2 py-1.5 tabular-nums text-[11px] font-medium text-slate-600 hover:bg-black/10"
              aria-label="Reset zoom"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => applyZoom(zoom + ZOOM_STEP)}
              className="px-3 py-1.5 text-base font-semibold leading-none text-slate-700 hover:bg-black/10"
              aria-label="Zoom in diagram"
              title="Zoom in"
            >+</button>
          </div>

          <p className="text-[12.5px] font-semibold tracking-tight text-slate-900">
            Teacher Smartboard Test
            <span className="ml-2 font-normal text-slate-500">
              tap a part of the diagram
            </span>
          </p>
        </div>


        <div className="min-h-0 flex-1 overflow-auto bg-white p-6">
          <div className="mx-auto w-full max-w-[1100px] bg-white">
            <div style={{ zoom }}>{board}</div>
          </div>
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
