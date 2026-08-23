// The presented lesson-note diagram, made reviewable.
//
// It renders the EXACT saved scene through the one existing presentation
// renderer. It only adds two things: it announces itself to the board's Review
// Properties state (so the top bar can offer REVIEW PROPERTIES), and it reports
// clicks / receives highlights for its own objects. No second viewer.

import { useEffect, useMemo } from "react";
import { PresentationGeometryDiagram } from "@/components/lessonnotes/extensions/GeometryDiagram";
import type { GeometryScene } from "@/lib/geometry/scene";
import {
  sceneHasReviewableProperties,
  useReviewProperties,
} from "@/lib/smartboard/reviewProperties";

let seq = 0;

export function ReviewableBoardDiagram({
  scene,
  diagramId,
  pageLayer,
}: {
  scene: GeometryScene;
  diagramId: string;
  pageLayer?: boolean;
}) {
  const review = useReviewProperties();
  const key = useMemo(() => `${diagramId || "diagram"}#${++seq}`, [diagramId]);
  const reviewable = useMemo(
    () => sceneHasReviewableProperties(scene, "teacher"),
    [scene],
  );

  useEffect(() => {
    if (!reviewable) return;
    review.register({ diagramId, scene }, key);
    return () => review.register(null, key);
    // `review.register` is stable; scene identity drives re-registration.
  }, [reviewable, diagramId, scene, key, review.register]);

  const isActive = review.open && review.active?.diagramId === diagramId;

  return (
    <PresentationGeometryDiagram
      scene={scene}
      pageLayer={pageLayer}
      highlightIds={isActive ? review.highlightIds : undefined}
      onPickObject={
        review.open && reviewable
          ? (id) => review.pickObject({ diagramId, scene }, id)
          : undefined
      }
    />
  );
}

export default ReviewableBoardDiagram;
