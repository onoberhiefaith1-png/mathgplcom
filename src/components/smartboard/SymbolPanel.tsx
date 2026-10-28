// SymbolPanel — vertical strip of operator / relation / bracket glyphs,
// anchored to the right edge of the active example's solution box. No
// background, drags vertically (and may be pulled horizontally inwards
// closer to the equation). Per-beat position memory.

import { useEffect, useRef, useState } from "react";

interface Props {
  chromeFg: string;
  visible: boolean;
  onInsert: (ch: string) => void;
  /** Board-space x for the panel's default right edge (panel is right-anchored). */
  rightPx: number;
  /** Minimum allowed x (the right edge of the band, beyond which it would cross
   *  into the equation area). */
  minRightPx: number;
  /** Maximum allowed x (board canvas right edge). */
  maxRightPx: number;
  defaultYPx: number;
  topYPx: number;
  bottomYPx: number;
  finalLineBottomPx: number;
  rememberedY: number | null;
  rememberedRight: number | null;
  onCommitY: (y: number) => void;
  onCommitRight: (r: number) => void;
  onPing: () => void;
  beatId?: string;
}

const SYMBOLS = ["=", "+", "−", "×", "÷"];

export const SymbolPanel = ({
  chromeFg, visible, onInsert,
  rightPx, minRightPx, maxRightPx,
  defaultYPx, topYPx, bottomYPx, finalLineBottomPx,
  rememberedY, rememberedRight, onCommitY, onCommitRight, onPing, beatId,
}: Props) => {
  const [y, setY] = useState<number>(rememberedY ?? defaultYPx);
  const [right, setRight] = useState<number>(rememberedRight ?? rightPx);
  const dragRef = useRef<{ dy: number; dx: number } | null>(null);

  useEffect(() => {
    setY(rememberedY ?? defaultYPx);
    setRight(rememberedRight ?? rightPx);
  }, [beatId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setY((prev) => {
      const upper = Math.max(finalLineBottomPx + 8, topYPx);
      return Math.min(bottomYPx, Math.max(upper, prev));
    });
  }, [topYPx, bottomYPx, finalLineBottomPx]);
  useEffect(() => {
    setRight((prev) => Math.min(maxRightPx, Math.max(minRightPx, prev)));
  }, [minRightPx, maxRightPx]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dy: e.clientY - y, dx: e.clientX + right };
    onPing();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const nextY = e.clientY - dragRef.current.dy;
    const upper = Math.max(finalLineBottomPx + 8, topYPx);
    setY(Math.min(bottomYPx, Math.max(upper, nextY)));
    const nextRight = dragRef.current.dx - e.clientX;
    setRight(Math.min(maxRightPx, Math.max(minRightPx, nextRight)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) { onCommitY(y); onCommitRight(right); }
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  if (!visible) return null;

  return (
    <div
      data-sb-chrome
      onPointerDown={(e) => { e.stopPropagation(); onPing(); }}
      style={{
        position: "absolute",
        right,
        top: y,
        transform: "translate(0, -50%)",
        zIndex: 25,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "8px 6px",
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="Drag"
        style={{
          width: 36, height: 14, borderRadius: 4,
          background: `color-mix(in oklab, ${chromeFg} 35%, transparent)`,
          cursor: "grab", touchAction: "none", flexShrink: 0,
        }}
      />
      <div
        className="flex flex-col items-center select-none"
        style={{ color: chromeFg, fontSize: 22, gap: 6, fontFamily: "ui-serif, Georgia, serif" }}
      >
        {SYMBOLS.map((s) => (
          <button
            key={`sy-${s}`}
            onClick={(e) => { e.stopPropagation(); onInsert(s); onPing(); }}
            className="transition-transform hover:scale-110 active:scale-95"
            style={{
              background: "transparent", border: 0, color: chromeFg,
              padding: "0 4px", cursor: "pointer", lineHeight: 1.1,
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SymbolPanel;
