import { useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";

const OFFSET = 68;
/** Offset the actual erasing tip from the thumb. Pointer capture makes this
 * equally usable with touch and pen; no window listeners survive unmount. */
export function PrecisionEraser({ bounds, onErase }: {
  bounds: () => DOMRect | null; onErase: (x: number, y: number) => void;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const rect = bounds();
  const x = position?.x ?? Math.max(44, (rect?.left ?? 0) + 52);
  const y = position?.y ?? Math.max(120, Math.min(window.innerHeight - 190, (rect?.bottom ?? window.innerHeight) - 130));
  const wipe = (event: PointerEvent<HTMLButtonElement>) => {
    const r = bounds();
    const tip = { x: event.clientX, y: event.clientY - OFFSET };
    setPosition({ x: event.clientX, y: event.clientY });
    if (r && tip.x >= r.left && tip.x <= r.right && tip.y >= r.top && tip.y <= r.bottom) onErase(tip.x, tip.y);
  };
  return createPortal(<div data-sb-chrome="true" style={{ position: "fixed", left: x - 24, top: y - OFFSET,
    width: 48, height: OFFSET + 24, zIndex: 100, pointerEvents: "none" }}>
    <svg aria-hidden="true" viewBox="0 0 48 92" width="48" height="92" style={{ position: "absolute", top: 0, overflow: "visible" }}>
      <path d="M24 0 L15 17 L21 15 L21 59 L27 59 L27 15 L33 17 Z" fill="#8c6b1e" stroke="white" strokeWidth="2" />
      <circle cx="24" cy="1" r="3" fill="#b78b28" stroke="white" />
    </svg>
    <button type="button" aria-label="Precision eraser — drag the handle; the arrow tip erases"
      title="Drag here. The arrow tip erases above your finger."
      onPointerDown={event => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); wipe(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) wipe(event); }}
      onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}
      style={{ position: "absolute", top: OFFSET - 24, width: 48, height: 48, borderRadius: "50%", touchAction: "none",
        pointerEvents: "auto", border: "2px solid white", background: dragging ? "#6b5015" : "#8c6b1e", color: "white", boxShadow: "0 3px 12px #0003", cursor: "grab" }}>
      <span aria-hidden="true" style={{ fontSize: 22 }}>⠿</span>
    </button>
  </div>, document.body);
}
