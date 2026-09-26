// The presented lesson-note diagram, made reviewable.
//
// It renders the EXACT saved scene through the one existing presentation
// renderer. It only adds three things: it announces itself to the board's
// Review Properties state, it reports clicks / receives highlights for its own
// objects, and — when the teacher authored Geometry Properties for this exact
// diagram — it shows a small icon beside the diagram that opens the full-screen
// relationship page for THAT diagram. No second viewer, no second engine.

import { useEffect, useMemo, useRef, useState } from "react";
import { Shapes } from "lucide-react";
import { PresentationGeometryDiagram } from "@/components/lessonnotes/extensions/GeometryDiagram";
import { DiagramZoomControl } from "@/components/lessonnotes/geometry-editor/DiagramZoomControl";
import { clampBoundedOffset, clampVisualZoom } from "@/lib/visualTransform";
import { useHoverIdleVisibility } from "@/hooks/useHoverIdleVisibility";
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
  authoredZoom,
  authoredOffsetX,
  authoredOffsetY,
  notebookId,
}: {
  scene: GeometryScene;
  diagramId: string;
  pageLayer?: boolean;
  /** Board zoom — the figure scales with the writing, keeping proportions. */
  zoom?: number;
  authoredZoom?: number;
  authoredOffsetX?: number;
  authoredOffsetY?: number;
  notebookId?: string;
}) {
  const review = useReviewProperties();
  const keyRef = useRef<string>("");
  if (!keyRef.current) keyRef.current = `rvw_${++seq}`;
  const key = keyRef.current;
  // Per-diagram zoom multiplies the board zoom: one uniform factor, so the
  // figure keeps its exact proportions and its mathematics.
  const [local, setLocal] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const { visible, bind, ping } = useHoverIdleVisibility({ idleMs: 10000, hideWhileInside: true });
  const noteZoom = clampVisualZoom(authoredZoom);
  const effectiveZoom = (Number.isFinite(zoom) && (zoom as number) > 0 ? (zoom as number) : 1) * noteZoom * local;
  const totalX = (Number(authoredOffsetX) || 0) + offset.x;
  const totalY = (Number(authoredOffsetY) || 0) + offset.y;

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
    <div
      className="relative group/diagram overflow-visible"
      {...bind}
      onPointerDown={(e) => {
        bind.onPointerDown();
        if ((e.target as HTMLElement).closest("button")) return;
        const host = e.currentTarget;
        const startX = e.clientX;
        const startY = e.clientY;
        const base = offset;
        let next = base;
        const onMove = (ev: PointerEvent) => {
          const width = host.parentElement?.clientWidth ?? host.clientWidth;
          const rect = host.getBoundingClientRect();
          next = {
            x: clampBoundedOffset(base.x + ev.clientX - startX, -rect.width * 0.2, Math.max(0, width - rect.width * 0.2)),
            y: clampBoundedOffset(base.y + ev.clientY - startY, -24, 160),
          };
          setOffset(next);
          ping();
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }}
      style={{
        transform: `translateX(${totalX}px) translateY(${Math.min(0, totalY)}px)`,
        paddingTop: Math.max(0, totalY),
        cursor: "move",
      }}
    >
      <PresentationGeometryDiagram
        scene={scene}
        pageLayer={pageLayer}
        zoom={effectiveZoom}
        highlightIds={isActive ? review.highlightIds : undefined}
        onPickObject={
          review.open && reviewable && diagramId
            ? (id) => reviewProperties.pickObject({ diagramId, scene, notebookId }, id)
            : undefined
        }
      />

      {/* DIAGRAM ZOOM — this figure only, never the page or the app. */}
      <div className={`absolute -top-1 right-0 transition-opacity ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <DiagramZoomControl zoom={local} onZoom={(value) => { setLocal(clampVisualZoom(value)); ping(); }} compact />
      </div>

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
