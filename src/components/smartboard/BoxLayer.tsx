// BoxLayer — line-anchored slots that act as manual numerator /
// denominator cells. The box's stored (x, y) is the **anchor point on the
// SmartLine** (closest point on the segment). Rendering then offsets the
// editable above or below that anchor by a fixed hairline gap so the digit's
// bottom (for top side) or top (for bottom side) sits a few px off the line.
// This gives the "perfect look" of a real fraction with no overlap.
//
// The box is also the writing sensor when focused: tapping it routes all
// keystrokes / chip taps into the box, and the main board sensor stays put.

import { useEffect, useRef } from "react";
import type { SmartLine } from "./SmartLineLayer";
import { PLACEHOLDER_COLOR, smartboardPlaceholderStyle } from "@/lib/smartboard/placeholderColor";

export interface MagnetBox {
  id: string;
  /** Anchor x on the attached line (canvas px). */
  x: number;
  /** Anchor y on the attached line (canvas px). */
  y: number;
  /** Side of the line the slot grows toward. */
  side: "top" | "bottom";
  attachedLineId: string;
  text: string;
}

export const newMagnetBox = (
  anchorX: number,
  anchorY: number,
  side: "top" | "bottom",
  attachedLineId: string,
): MagnetBox => ({
  id: `box_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  x: anchorX,
  y: anchorY,
  side,
  attachedLineId,
  text: "",
});

interface Props {
  boxes: MagnetBox[];
  ink: string;
  onChange: (next: MagnetBox[]) => void;
  smartLines: SmartLine[];
  activeBoxId?: string | null;
  onActivate?: (id: string | null) => void;
  fontPx?: number;
  placeholderColor?: string;
}

/** Pixel gap between the line and the text edge. */
const GAP = 3;
/** Drag distance from the line beyond which we detach (delete) the box. */
const DETACH_MULT = 1.6;

/** Project point (px, py) onto SmartLine segment; return closest point + perp dist + side. */
const projectOnLine = (px: number, py: number, l: SmartLine) => {
  const rad = (l.angle * Math.PI) / 180;
  const ux = Math.cos(rad), uy = Math.sin(rad);
  const half = l.length / 2;
  const ax = l.x - ux * half, ay = l.y - uy * half;
  const bx = l.x + ux * half, by = l.y + uy * half;
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (l.length * l.length)));
  const cx = ax + t * (bx - ax);
  const cy = ay + t * (by - ay);
  const ddx = px - cx, ddy = py - cy;
  const dist = Math.hypot(ddx, ddy);
  const cross = ux * ddy - uy * ddx;
  return { cx, cy, dist, side: cross >= 0 ? "bottom" : ("top" as "top" | "bottom") };
};

export const BoxLayer = ({
  boxes, ink, onChange, smartLines, activeBoxId, onActivate, fontPx,
  placeholderColor = PLACEHOLDER_COLOR,
}: Props) => {
  const dragRef = useRef<{ id: string; pid: number; moved: boolean } | null>(null);

  const startDrag = (e: React.PointerEvent, b: MagnetBox) => {
    e.stopPropagation();
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragRef.current = { id: b.id, pid: e.pointerId, moved: false };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const b = boxes.find((x) => x.id === d.id);
    if (!b) return;
    const line = smartLines.find((l) => l.id === b.attachedLineId);
    if (!line) return;
    // Convert pointer client coords → canvas coords using the slot's parent.
    const parent = (e.currentTarget as HTMLElement).parentElement?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const p = projectOnLine(px, py, line);
    d.moved = true;
    onChange(boxes.map((x) => x.id === b.id ? { ...x, x: p.cx, y: p.cy } : x));
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!d) return;
    if (!d.moved) return;
    const b = boxes.find((x) => x.id === d.id);
    if (!b) return;
    const line = smartLines.find((l) => l.id === b.attachedLineId);
    if (!line) return;
    const parent = (e.currentTarget as HTMLElement).parentElement?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const p = projectOnLine(px, py, line);
    const threshold = (fontPx ?? 34) * DETACH_MULT;
    if (p.dist > threshold) {
      // Detach → delete (slot has no meaning off its line).
      onChange(boxes.filter((x) => x.id !== b.id));
      return;
    }
    onChange(boxes.map((x) => x.id === b.id ? { ...x, x: p.cx, y: p.cy } : x));
  };

  return (
    <>
      {boxes.map((b) => (
        <BoxView
          key={b.id}
          box={b}
          ink={ink}
          active={activeBoxId === b.id}
          fontPx={fontPx}
          placeholderColor={placeholderColor}
          onActivate={onActivate}
          onPointerDown={(e) => startDrag(e, b)}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onTextChange={(t) => onChange(boxes.map((x) => x.id === b.id ? { ...x, text: t } : x))}
        />
      ))}
    </>
  );
};

const BoxView = ({
  box, ink, active, fontPx, placeholderColor, onActivate,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onTextChange,
}: {
  box: MagnetBox;
  ink: string;
  active: boolean;
  fontPx?: number;
  placeholderColor: string;
  onActivate?: (id: string | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onTextChange: (t: string) => void;
}) => {
  const editRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = editRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== box.text) el.innerText = box.text;
  }, [box.text]);

  useEffect(() => {
    if (active && editRef.current && document.activeElement !== editRef.current) {
      editRef.current.focus();
    }
  }, [active]);

  const fs = fontPx ?? 34;
  const height = Math.round(fs * 1.05);
  const minWidth = Math.round(fs * 0.7);
  const filled = box.text.trim().length > 0;

  // Position the slot so its line-facing edge sits GAP px from the anchor.
  // top side: slot bottom = anchor.y - GAP  → top = anchor.y - GAP - height
  // bottom side: slot top = anchor.y + GAP
  const top = box.side === "top" ? box.y - GAP - height : box.y + GAP;
  const left = box.x; // we centre horizontally via translateX(-50%)

  const emptySlotStyle = smartboardPlaceholderStyle(placeholderColor, {
    size: "box",
    active,
    caretColor: ink,
    cursor: "grab",
  });
  const borderStyle = filled
    ? "1.5px solid transparent"
    : String(emptySlotStyle.border ?? `1.5px dashed ${placeholderColor}`);

  return (
    <div
      data-sb-chrome
      data-sb-placeholder={!filled ? "box-layer" : undefined}
      data-erase-box-id={box.id}
      style={{
        ...(!filled ? emptySlotStyle : {}),
        position: "absolute",
        top,
        left,
        transform: "translateX(-50%)",
        height,
        minWidth,
        padding: "0 4px",
        border: borderStyle,
        borderRadius: 4,
        color: filled ? ink : placeholderColor,
        background: filled ? "transparent" : placeholderColor,
        pointerEvents: "auto",
        zIndex: 26,
        display: "flex",
        alignItems: box.side === "top" ? "flex-end" : "flex-start",
        justifyContent: "center",
        touchAction: "none",
        cursor: "grab",
        boxSizing: "content-box",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onPointerDown={(e) => { e.stopPropagation(); }}
        onFocus={() => onActivate?.(box.id)}
        onInput={(e) => onTextChange((e.target as HTMLDivElement).innerText)}
        style={{
          minWidth: minWidth - 8,
          outline: "none",
          fontFamily: "ui-serif, Georgia, serif",
          fontSize: fs,
          lineHeight: 1,
          textAlign: "center",
          color: ink,
          cursor: "text",
          whiteSpace: "nowrap",
        }}
      />
    </div>
  );
};
