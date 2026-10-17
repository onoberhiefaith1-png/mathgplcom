// Diagrams written on a Game writing surface: the question's own diagram on
// the question surface, or a solution-note diagram once its note is reached.
// 2D geometry only (the Game never loads 3D). The diagram stays clickable and
// its properties are written beneath it inside the same surface, which grows.

import { memo } from "react";
import { ReviewableBoardDiagram } from "@/components/smartboard/ReviewableBoardDiagram";
import { sanitizeScene } from "@/lib/geometry/scene";

export type GameSurfaceDiagram = {
  objId: string;
  nodeType: string;
  attrs?: Record<string, unknown>;
};

export const GameSurfaceDiagrams = memo(function GameSurfaceDiagrams({
  diagrams,
  notebookId,
}: {
  diagrams: GameSurfaceDiagram[];
  notebookId?: string;
}) {
  const shown = diagrams
    .filter((d) => d.nodeType === "geometryDiagram")
    .map((d) => ({ d, scene: sanitizeScene((d.attrs as any)?.scene) }))
    .filter((x) => x.scene);
  if (!shown.length) return null;
  return (
    <div
      data-game-surface-diagrams
      className="w-full"
      style={{ whiteSpace: "normal" }}
      // Tapping the diagram must not move the writing cursor.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {shown.map(({ d, scene }) => (
        <div key={d.objId} className="my-5 w-full max-w-full">
          <ReviewableBoardDiagram
            scene={scene!}
            diagramId={String((d.attrs as any)?.diagramId ?? d.objId)}
            pageLayer={(d.attrs as any)?.pageLayer === true}
            authoredZoom={(d.attrs as any)?.zoom as number | undefined}
            authoredOffsetX={(d.attrs as any)?.offsetX as number | undefined}
            authoredOffsetY={(d.attrs as any)?.offsetY as number | undefined}
            notebookId={notebookId}
            role="student"
          />
        </div>
      ))}
    </div>
  );
});

export default GameSurfaceDiagrams;
