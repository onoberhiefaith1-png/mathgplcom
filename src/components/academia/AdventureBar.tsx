// A learning point's bars inside the Academia Adventure player.
//
// A designed bar is drawn by the editor's own renderer (`CanvasElementView`) at
// the place and size the creator stored, inside the same 16:9 stage as the video
// (see `barGeometry`). A bar that was never designed is a plain high-contrast
// default drawn at the screen's edge. Neither takes touches.
import CanvasElementView from "@/components/gamebuilder/CanvasElementView";
import { barElementFor } from "@/lib/academia/barGeometry";
import type { CanvasElement } from "@/lib/games/types";

const noop = () => undefined;

/** The creator's bar at its stored geometry. Render it inside the stage layer (position: relative, stage-sized). */
export function DesignedStageBar({ element, current, max, stageWidth, label, fillIsTimeLeft = false }: {
  element: CanvasElement;
  current: number;
  max: number;
  /** Stage width in px (drives the editor's size-dependent effects). */
  stageWidth: number;
  label: string;
  fillIsTimeLeft?: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="designed-bar" aria-label={label}>
      <CanvasElementView
        element={barElementFor(element, current, max, { fillIsTimeLeft })}
        stageEl={null}
        stageWidth={stageWidth}
        selected={false}
        editable={false}
        onSelect={noop}
        onMove={noop}
      />
    </div>
  );
}

type DefaultProps = {
  /** 0..max */
  current: number;
  max: number;
  /** Where the pass mark sits (1–100), if it has one. */
  passPct?: number;
  tone?: "primary" | "accent";
  label: string;
};

/** The plain bar used when the creator never placed one. */
export default function DefaultBar({ current, max, passPct, tone = "primary", label }: DefaultProps) {
  const safeMax = max > 0 ? max : 1;
  const share = Math.min(1, Math.max(0, current / safeMax));
  return (
    <div className="relative h-full w-5 overflow-hidden rounded-full border-2 border-white/90 bg-black/45 shadow-lg ring-1 ring-black/40" data-testid="default-bar" aria-label={label}>
      <div className={`absolute inset-x-0 bottom-0 transition-all duration-500 ${tone === "accent" ? "bg-accent" : "bg-primary"}`} style={{ height: `${share * 100}%`, minHeight: share > 0 ? 4 : 0 }} />
      {passPct != null && <div className="absolute inset-x-0 h-0.5 bg-white" style={{ bottom: `${passPct}%` }} />}
    </div>
  );
}
