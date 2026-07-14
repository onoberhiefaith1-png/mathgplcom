import { useEffect, useRef, useState } from "react";
import CanvasElementView from "./CanvasElementView";
import type { CanvasElement } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface GameCanvasProps {
  elements: CanvasElement[];
  selectedId: string | null;
  editable?: boolean;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
  className?: string;
}

const GameCanvas = ({
  elements,
  selectedId,
  editable = true,
  onSelect,
  onMove,
  className,
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

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl border border-border/50 bg-black shadow-2xl",
        className,
      )}
      onPointerDown={() => editable && onSelect?.(null)}
    >
      {sorted.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Pick a background, reward, or progress bar to begin.
        </div>
      )}
      {sorted.map((el) => (
        <CanvasElementView
          key={el.id}
          element={el}
          stageEl={stageRef.current}
          stageWidth={width}
          selected={el.id === selectedId}
          editable={editable}
          onSelect={(id) => onSelect?.(id)}
          onMove={(id, x, y) => onMove?.(id, x, y)}
        />
      ))}
    </div>
  );
};

export default GameCanvas;
