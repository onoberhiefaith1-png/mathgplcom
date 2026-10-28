// One zoom control, reused on every page that shows a diagram.
//
// Purely presentational: − / percentage / +. The percentage is a reset button.
// Scaling itself is uniform and lives in the diagram renderer, so pressing
// these buttons can never distort a figure or change its mathematics.

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VISUAL_ZOOM_MAX,
  VISUAL_ZOOM_MIN,
  VISUAL_ZOOM_STEP,
  clampVisualZoom,
} from "@/lib/visualTransform";

export const DIAGRAM_ZOOM_MIN = VISUAL_ZOOM_MIN;
export const DIAGRAM_ZOOM_MAX = VISUAL_ZOOM_MAX;
export const DIAGRAM_ZOOM_STEP = VISUAL_ZOOM_STEP;

export function clampDiagramZoom(z: number): number {
  return clampVisualZoom(z);
}

export function DiagramZoomControl({
  zoom,
  onZoom,
  className,
  compact,
}: {
  zoom: number;
  onZoom: (next: number) => void;
  className?: string;
  compact?: boolean;
}) {
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
  const btn = cn(
    "grid place-items-center rounded-full text-foreground/70 hover:bg-foreground/10 disabled:opacity-40",
    compact ? "h-5 w-5" : "h-6 w-6",
  );
  return (
    <div
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={stop}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-foreground/15 bg-background/85 px-1 py-[1px] shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        title="Zoom out"
        aria-label="Zoom the diagram out"
        disabled={zoom <= DIAGRAM_ZOOM_MIN}
        onClick={(e) => { e.stopPropagation(); onZoom(clampDiagramZoom(zoom - DIAGRAM_ZOOM_STEP)); }}
      >
        <Minus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onZoom(1); }}
        className={cn(
          "min-w-[3.1rem] rounded-full px-1 text-center font-semibold tabular-nums text-foreground/75 hover:bg-foreground/10",
          compact ? "text-[10px]" : "text-[11px]",
        )}
        title="Reset the diagram to 100%"
        aria-label="Reset the diagram zoom to 100%"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        className={btn}
        title="Zoom in"
        aria-label="Zoom the diagram in"
        disabled={zoom >= DIAGRAM_ZOOM_MAX}
        onClick={(e) => { e.stopPropagation(); onZoom(clampDiagramZoom(zoom + DIAGRAM_ZOOM_STEP)); }}
      >
        <Plus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
    </div>
  );
}

export default DiagramZoomControl;
