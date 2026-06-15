import { useEffect, useRef, useState } from "react";

interface Props {
  x: number; y: number; w: number; h: number;
  selected?: boolean;
  onChange: (v: { x: number; y: number; w: number; h: number }) => void;
  onSelect?: () => void;
  containerRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  className?: string;
  minW?: number;
  minH?: number;
  hideIdleOutline?: boolean;
}

/** Drag + resize child, positioned as percentages of containerRef. */
export default function DraggableResizable({
  x,
  y,
  w,
  h,
  selected,
  onChange,
  onSelect,
  containerRef,
  children,
  className,
  minW = 4,
  minH = 4,
  hideIdleOutline = false,
}: Props) {
  const [drag, setDrag] = useState<null | { mode: "move" | "resize"; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number } }>(null);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drag) return;
    const handleMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
      if (drag.mode === "move") {
        onChange({
          x: clamp(drag.orig.x + dxPct, 0, 100 - drag.orig.w),
          y: clamp(drag.orig.y + dyPct, 0, 100 - drag.orig.h),
          w: drag.orig.w, h: drag.orig.h,
        });
      } else {
        onChange({
          x: drag.orig.x, y: drag.orig.y,
          w: clamp(drag.orig.w + dxPct, minW, 100 - drag.orig.x),
          h: clamp(drag.orig.h + dyPct, minH, 100 - drag.orig.y),
        });
      }
    };
    const handleUp = () => setDrag(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [drag, containerRef, onChange, minW, minH]);

  const outlineClass = selected
    ? "ring-2 ring-primary"
    : hideIdleOutline
      ? "ring-0"
      : "ring-1 ring-border/40 hover:ring-primary/60";

  return (
    <div
      ref={elRef}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).dataset.resize) return;
        e.stopPropagation();
        onSelect?.();
        setDrag({ mode: "move", startX: e.clientX, startY: e.clientY, orig: { x, y, w, h } });
      }}
      style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, cursor: "move", touchAction: "none" }}
      className={`${className ?? ""} ${outlineClass} rounded-md`}
    >
      {children}
      {selected && (
        <div
          data-resize="1"
          onPointerDown={(e) => {
            e.stopPropagation();
            setDrag({ mode: "resize", startX: e.clientX, startY: e.clientY, orig: { x, y, w, h } });
          }}
          className="absolute right-0 bottom-0 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-sm bg-primary"
        />
      )}
    </div>
  );
}


function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
