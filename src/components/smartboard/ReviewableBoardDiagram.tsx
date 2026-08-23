// The presented lesson-note diagram, made reviewable.
//
// It renders the EXACT saved scene through the one existing presentation
// renderer. It only adds two things: it announces itself to the board's Review
// Properties state (so the top bar can offer REVIEW PROPERTIES), and it reports
// clicks / receives highlights for its own objects. No second viewer.

import { useEffect, useMemo, useRef } from "react";
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
}: {
  scene: GeometryScene;
  diagramId: string;
  pageLayer?: boolean;
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
    reviewProperties.register({ diagramId, scene }, key);
    return () => reviewProperties.register(null, key);
  }, [reviewable, diagramId, scene, key]);

  const isActive = review.open && review.active?.diagramId === diagramId;

  return (
    <PresentationGeometryDiagram
      scene={scene}
      pageLayer={pageLayer}
      highlightIds={isActive ? review.highlightIds : undefined}
      onPickObject={
        review.open && reviewable && diagramId
          ? (id) => reviewProperties.pickObject({ diagramId, scene }, id)
          : undefined
      }
    />
  );
}

export default ReviewableBoardDiagram;
