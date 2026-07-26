import { useEffect, useRef, useState } from "react";
import CanvasElementView from "./CanvasElementView";
import type { CanvasElement } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface GameCanvasProps {
  elements: CanvasElement[];
  selectedId: string | null;
  pinnedId?: string | null;
  editable?: boolean;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
  className?: string;
  /** Number of 16:9 sections tall (1 = default). */
  heightUnits?: number;
  /** When true, fill the parent (no intrinsic aspect-ratio). Parent controls size. */
  fill?: boolean;
}

/**
 * The infinite vertical game stage — 16:9 wide, N sections tall.
 * Elements are positioned with normalized coordinates: x ∈ [0..1] of width,
 * y ∈ [0..1] of the full canvas height.
 */
const GameCanvas = ({
  elements,
  selectedId,
  pinnedId = null,
  editable = true,
  onSelect,
  onMove,
  className,
  heightUnits = 1,
  fill = false,
}: GameCanvasProps) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const sorted = [...elements].sort((a, b) => a.z - b.z);
  const units = Math.max(1, Math.floor(heightUnits) || 1);

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-border/50 bg-black shadow-2xl",
        fill && "h-full rounded-none border-0",
        className,
      )}
      style={fill ? undefined : { aspectRatio: `16 / ${9 * units}` }}
      onPointerDown={() => editable && onSelect?.(null)}
    >
      {sorted.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Add a background, reward or progress bar to begin.
        </div>
      )}
      {sorted.map((el) => (
        <CanvasElementView
          key={el.id}
          element={el}
          stageEl={stageRef.current}
          stageWidth={width}
          selected={el.id === selectedId}
          pinned={el.id === pinnedId}
          editable={editable}
          onSelect={(id) => onSelect?.(id)}
          onMove={(id, x, y) => onMove?.(id, x, y)}
        />
      ))}
    </div>
  );
};

export default GameCanvas;

