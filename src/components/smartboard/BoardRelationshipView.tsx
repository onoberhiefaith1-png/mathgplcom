// The student-facing relationship page, opened from the properties icon beside
// a presented diagram. Same layout as the teacher's Smartboard test: the whole
// screen is the diagram, with that diagram's properties on the right. Closing
// returns to the Smartboard with the lesson exactly where it was.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { ReviewPropertiesPanel } from "@/components/smartboard/ReviewPropertiesPanel";
import { itemObjectIds, type GeometryMapItem } from "@/lib/geometry/map/model";
import { reviewProperties, useReviewProperties } from "@/lib/smartboard/reviewProperties";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.5;
const ZOOM_STEP = 0.12;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

function zoomKey(notebookId: string | undefined) {
  return `smartboard:relationship-zoom:${notebookId ?? "_"}`;
}

export function BoardRelationshipView() {
  const review = useReviewProperties();
  if (!review.fullscreen || !review.active) return null;
  const scene = review.active.scene;
  const notebookId = review.active.notebookId;

  const [zoom, setZoom] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(zoomKey(notebookId));
      if (raw) {
        const z = parseFloat(raw);
        if (Number.isFinite(z) && z > 0) return clampZoom(z);
      }
    } catch { /* noop */ }
    return 1;
  });

  useEffect(() => {
    try { localStorage.setItem(zoomKey(notebookId), String(zoom)); } catch { /* noop */ }
  }, [notebookId, zoom]);

  const applyZoom = (next: number) => setZoom(clampZoom(next));

  const pick = (item: GeometryMapItem | null) => {
    if (!item) {
      reviewProperties.pickProperty(null, []);
      return;
    }
    reviewProperties.pickProperty(item.id, itemObjectIds(item));
  };

  return (
    <div className="fixed inset-0 z-[120] flex bg-white text-[#0f172a]">
      <div className="relative flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex items-center gap-3 border-b border-black/10 bg-white px-3 py-2">
          <button
            type="button"
            onClick={() => reviewProperties.close()}
            className="inline-flex items-center gap-1.5 rounded-md border border-black/15 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-black/5"
          >
            <X className="h-3.5 w-3.5" /> Close
          </button>
          <p className="text-[12.5px] font-semibold tracking-tight text-slate-900">
            Geometry relationships
            <span className="ml-2 font-normal text-slate-500">
              tap a part of the diagram
            </span>
          </p>

          <div className="ml-auto inline-flex items-center gap-0.5 rounded-md bg-black/5">
            <button
              type="button"
              onClick={() => applyZoom(zoom - ZOOM_STEP)}
              className="px-2.5 py-1.5 text-base leading-none text-slate-700 hover:bg-black/5"
              aria-label="Zoom out diagram"
              title="Zoom out"
            >−</button>
            <button
              type="button"
              onClick={() => applyZoom(1)}
              className="px-2 py-1.5 tabular-nums text-[10px] text-slate-600 hover:bg-black/5"
              aria-label="Reset zoom"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => applyZoom(zoom + ZOOM_STEP)}
              className="px-2.5 py-1.5 text-base leading-none text-slate-700 hover:bg-black/5"
              aria-label="Zoom in diagram"
              title="Zoom in"
            >+</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-white p-6">
          <div className="mx-auto w-full max-w-[1100px] bg-white">
            <div style={{ zoom }}>
              <GeometryDiagram
                scene={scene}
                large
                highlightIds={review.highlightIds}
                onPickObject={(id) =>
                  reviewProperties.pickObject(review.active!, id)
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="h-full w-[22%] min-w-[260px] bg-white">
        <ReviewPropertiesPanel
          scene={scene}
          role="teacher"
          selectedObjectId={review.selectedObjectId}
          activePropertyId={review.activePropertyId}
          onPickProperty={pick}
          onClose={() => reviewProperties.close()}
          fg="#0f172a"
          bg="#ffffff"
          border="rgba(15,23,42,0.14)"
          accent="#2563eb"
        />
      </div>
    </div>
  );
}

export default BoardRelationshipView;
