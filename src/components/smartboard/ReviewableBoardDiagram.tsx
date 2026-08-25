// The presented lesson-note diagram, made reviewable.
//
// It renders the EXACT saved scene through the one existing presentation
// renderer. It only adds three things: it announces itself to the board's
// Review Properties state, it reports clicks / receives highlights for its own
// objects, and — when the teacher authored Geometry Properties for this exact
// diagram — it shows a small icon beside the diagram that opens the full-screen
// relationship page for THAT diagram. No second viewer, no second engine.

import { useEffect, useMemo, useRef } from "react";
import { Shapes } from "lucide-react";
import { PresentationGeometryDiagram } from "@/components/lessonnotes/extensions/GeometryDiagram";
import type { GeometryScene } from "@/lib/geometry/scene";
import {
  reviewProperties,
  sceneHasReviewableProperties,
  useReviewProperties,
} from "@/lib/smartboard/reviewProperties";

let seq = 0;

export function ReviewableBoardDiagram({
  scene,
  diagramId,
  pageLayer,
  zoom,
  notebookId,
}: {
  scene: GeometryScene;
  diagramId: string;
  pageLayer?: boolean;
  /** Board zoom — the figure scales with the writing, keeping proportions. */
  zoom?: number;
  notebookId?: string;
}) {
  const review = useReviewProperties();
  const keyRef = useRef<string>("");
  if (!keyRef.current) keyRef.current = `rvw_${++seq}`;
  const key = keyRef.current;

  const reviewable = useMemo(
    () => sceneHasReviewableProperties(scene, "teacher"),
    [scene],
  );

  useEffect(() => {
    if (!reviewable || !diagramId) return;
    reviewProperties.register({ diagramId, scene, notebookId }, key);
    return () => reviewProperties.register(null, key);
  }, [reviewable, diagramId, scene, notebookId, key]);

  const isActive = review.open && review.active?.diagramId === diagramId;

  return (
    <div className="relative">
      <PresentationGeometryDiagram
        scene={scene}
        pageLayer={pageLayer}
        zoom={zoom}
        highlightIds={isActive ? review.highlightIds : undefined}
        onPickObject={
          review.open && reviewable && diagramId
            ? (id) => reviewProperties.pickObject({ diagramId, scene, notebookId }, id)
            : undefined
        }
      />

      {/* GEOMETRY PROPERTIES MARKER — present only when THIS diagram carries
          teacher-authored properties, wherever the diagram lives (Example,
          Solution note, Introduction). Clicking opens the relationship page. */}
      {reviewable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            reviewProperties.openFor({ diagramId, scene, notebookId }, true);
          }}
          className="absolute -top-1 left-0 inline-flex items-center gap-1 rounded-full border border-black/20 bg-white/90 px-2 py-[3px] text-[11px] font-medium text-slate-800 shadow-sm hover:bg-white"
          title="This diagram has geometry properties — open the relationships"
          aria-label="Open geometry properties for this diagram"
        >
          <Shapes className="h-3.5 w-3.5" /> Properties
        </button>
      )}
    </div>
  );
}

export default ReviewableBoardDiagram;
