// SmartLine — a free, draggable, extendable, rotatable line that lives
// over the writing surface (not inside the math tree).
//
// Chrome blends with the board (no fills, no borders). Chips appear
// contextually:
//   • Drag + Rotate  — only while the line is "empty" (no numerator and
//                       no denominator written above/below).
//   • Plus / Minus   — only briefly (5s) when the teacher taps near one
//                       of the line's ends. Lets the teacher keep
//                       extending while writing without the icons
//                       getting in the way.
//
// To remove a line: use the eraser (touch the stroke) or Undo.

import { useEffect, useRef, useState } from "react";
import { Plus, Minus, RotateCcw, Move } from "lucide-react";

export type SmartLineAngle = number;
const ANGLE_CYCLE: number[] = [0, 45, 90, 135, 180];


export interface SmartLine {
  id: string;
  x: number;       // centre x in canvas pixels (relative to writing surface)
  y: number;       // centre y in canvas pixels (relative to writing surface)
  length: number;  // pixels
  angle: SmartLineAngle;
  /** Fixed-geometry line (e.g. Dot-tool polygon edge). No rotate / no +/-. */
  locked?: boolean;
}

export const newSmartLine = (
  cx: number, cy: number, len = 120, angle: number = 0, locked = false,
): SmartLine => ({
  id: `sl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  x: cx, y: cy, length: len, angle, locked,
});


interface Props {
  lines: SmartLine[];
  ink: string;
  onChange: (next: SmartLine[]) => void;
  cellPx: number; // one grid cell — used as the +/- increment
  /** Returns true when something has been written above or below the line.
   *  When true, drag/rotate chips are hidden. */
  isLineOccupied?: (line: SmartLine) => boolean;
  /** Bump this number whenever board content changes so occupancy is
   *  re-evaluated. */
  occupancyTick?: number;
}

const LEN_CHIP_MS = 5000;

export const SmartLineLayer = ({ lines, ink, onChange, cellPx, isLineOccupied, occupancyTick }: Props) => {
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [lenVisible, setLenVisible] = useState<Record<string, boolean>>({});
  const lenTimers = useRef<Record<string, number>>({});

  const showLen = (id: string) => {
    setLenVisible((m) => ({ ...m, [id]: true }));
    if (lenTimers.current[id]) window.clearTimeout(lenTimers.current[id]);
    lenTimers.current[id] = window.setTimeout(() => {
      setLenVisible((m) => ({ ...m, [id]: false }));
    }, LEN_CHIP_MS);
  };

  useEffect(() => () => {
    Object.values(lenTimers.current).forEach((t) => window.clearTimeout(t));
  }, []);

  // `occupancyTick` changing already re-renders this component (it's a
  // prop), so occupancy is re-evaluated naturally — no internal setState
  // echo needed. (The old echo state amplified parent update storms into
  // "Maximum update depth exceeded".)
  void occupancyTick;

  const startDrag = (e: React.PointerEvent, line: SmartLine) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: line.id, sx: e.clientX, sy: e.clientY, ox: line.x, oy: line.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    onChange(lines.map((l) => l.id === d.id ? { ...l, x: d.ox + dx, y: d.oy + dy } : l));
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    dragRef.current = null;
  };

  const mut = (id: string, patch: Partial<SmartLine>) =>
    onChange(lines.map((l) => l.id === id ? { ...l, ...patch } : l));

  const nextAngle = (a: SmartLineAngle): SmartLineAngle => {
    // Snap arbitrary current angle to the nearest cycle slot, then step.
    let bestI = 0; let bestD = Infinity;
    for (let i = 0; i < ANGLE_CYCLE.length; i++) {
      const d = Math.abs(((a - ANGLE_CYCLE[i] + 540) % 360) - 180);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return ANGLE_CYCLE[(bestI + 1) % ANGLE_CYCLE.length];
  };


  return (
    <>
      {lines.map((l) => {
        const occupied = isLineOccupied ? isLineOccupied(l) : false;
        const posVisible = !occupied;
        const showLenChips = !!lenVisible[l.id];
        return (
          <div
            key={l.id}
            data-sb-chrome
            style={{
              position: "absolute",
              left: l.x - l.length / 2,
              top: l.y - 1,
              width: l.length,
              height: 2,
              transform: `rotate(${l.angle}deg)`,
              transformOrigin: "center center",
              pointerEvents: "auto",
              zIndex: 25,
            }}
          >
            {/* Eraser hit-pad — invisible, ~18px tall, doesn't block pointer
                events (writing passes through), but elementsFromPoint still
                returns it so the eraser deletes the line on any near-touch. */}
            <div
              data-erase-line-id={l.id}
              aria-hidden
              style={{
                position: "absolute",
                left: 0, right: 0,
                top: -9, height: 20,
                background: "transparent",
                pointerEvents: "none",
              }}
            />
            {/* the visible stroke — also taggable for the eraser */}
            <div
              data-erase-line-id={l.id}
              onPointerDown={(e) => startDrag(e, l)}
              onPointerMove={onMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                position: "absolute", inset: 0,
                background: ink,
                borderRadius: 2,
                cursor: "grab",
                boxShadow: `0 0 4px ${ink}66`,
                touchAction: "none",
              }}
            />


            {/* Length +/- and rotate chips are hidden on locked lines
                (Dot-tool polygon edges) — those are fixed geometry. */}
            {!l.locked && (
              <>
                {/* Invisible hit-zones at both ends — tapping wakes +/- chips */}
                <EndHitZone
                  style={{ left: -28, top: -16, width: 32, height: 32 }}
                  onTap={() => showLen(l.id)}
                />
                <EndHitZone
                  style={{ right: -28, top: -16, width: 32, height: 32 }}
                  onTap={() => showLen(l.id)}
                />

                {showLenChips && (
                  <ChipButton
                    ink={ink}
                    style={{ left: -24, top: -10 }}
                    onClick={() => { mut(l.id, { length: Math.max(cellPx * 0.5, l.length - cellPx) }); showLen(l.id); }}
                    label={<Minus className="h-3 w-3" />}
                    title="Shorten"
                  />
                )}
                {showLenChips && (
                  <ChipButton
                    ink={ink}
                    style={{ right: -24, top: -10 }}
                    onClick={() => { mut(l.id, { length: l.length + cellPx }); showLen(l.id); }}
                    label={<Plus className="h-3 w-3" />}
                    title="Extend"
                  />
                )}
                {posVisible && (
                  <ChipButton
                    ink={ink}
                    style={{ left: "50%", top: -28, transform: "translateX(-50%)" }}
                    onClick={() => mut(l.id, { angle: nextAngle(l.angle) })}
                    label={<RotateCcw className="h-3 w-3" />}
                    title="Rotate"
                  />
                )}
              </>
            )}
            {/* Drag chip — only when line still empty */}
            {posVisible && (
              <DragChip
                ink={ink}
                style={{ left: "50%", top: 12, transform: "translateX(-50%)" }}
                onPointerDown={(e) => startDrag(e, l)}
                onPointerMove={onMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            )}
          </div>
        );
      })}
    </>
  );
};

const EndHitZone = ({ style, onTap }: { style: React.CSSProperties; onTap: () => void }) => (
  <div
    onPointerDown={(e) => { e.stopPropagation(); onTap(); }}
    style={{ position: "absolute", background: "transparent", ...style }}
  />
);

const ChipButton = ({
  onClick, label, style, ink, title,
}: {
  onClick: () => void;
  label: React.ReactNode;
  style: React.CSSProperties;
  ink: string;
  title: string;
}) => (
  <button
    onPointerDown={(e) => { e.stopPropagation(); }}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    title={title}
    aria-label={title}
    className="grid place-items-center rounded-full"
    style={{
      position: "absolute",
      width: 20, height: 20,
      background: "transparent",
      color: ink,
      border: "none",
      ...style,
    }}
  >
    {label}
  </button>
);

const DragChip = ({
  style, ink, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
}: {
  style: React.CSSProperties;
  ink: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}) => (
  <div
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    title="Drag"
    aria-label="Drag"
    className="grid place-items-center rounded-full"
    style={{
      position: "absolute",
      width: 20, height: 20,
      background: "transparent",
      color: ink,
      border: "none",
      cursor: "grab",
      touchAction: "none",
      ...style,
    }}
  >
    <Move className="h-3 w-3" />
  </div>
);
