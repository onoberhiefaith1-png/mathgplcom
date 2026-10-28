// SketchLayer — freehand capture used by the "Convert sketch" tool.
// Records pointer strokes; emits an SVG path preview; calls a converter
// when the teacher clicks "Convert".

import { useRef, useState } from "react";

export interface Stroke { points: { x: number; y: number }[] }

interface Props {
  width: number;
  height: number;
  pad: number;
  busy: boolean;
  onConvert: (strokes: Stroke[]) => void;
  onCancel: () => void;
}

export function SketchLayer({ width, height, pad, busy, onConvert, onCancel }: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);

  const toLogical = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = (e.target as SVGElement).ownerSVGElement!.getBoundingClientRect();
    const sx = (width + pad * 2) / rect.width;
    const sy = (height + pad * 2) / rect.height;
    return {
      x: (e.clientX - rect.left) * sx - pad,
      y: (e.clientY - rect.top) * sy - pad,
    };
  };

  return (
    <div className="absolute inset-0 z-20 bg-white/70 flex flex-col">
      <div className="px-3 py-1.5 flex items-center gap-2 text-xs bg-amber-100/70 border-b border-amber-300">
        <span className="font-medium">Sketch mode</span>
        <span className="text-foreground/70">Draw freely. The AI will reconstruct your sketch into a clean diagram.</span>
        <button
          type="button"
          onClick={() => setStrokes([])}
          className="ml-auto px-2 py-0.5 rounded border border-foreground/20 bg-white"
        >Clear</button>
        <button
          type="button"
          disabled={busy || strokes.length === 0}
          onClick={() => onConvert(strokes)}
          className="px-2 py-0.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
        >{busy ? "Converting…" : "Convert"}</button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-0.5 rounded border border-foreground/20 bg-white"
        >Cancel</button>
      </div>
      <svg
        viewBox={`0 0 ${width + pad * 2} ${height + pad * 2}`}
        className="flex-1 cursor-crosshair"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          drawing.current = { points: [toLogical(e)] };
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          drawing.current.points.push(toLogical(e));
          setStrokes((s) => [...s.slice(0, -1), ...(s.length ? [s[s.length - 1]] : []), drawing.current!]
            .slice(s.length ? -s.length : 0));
          // Force re-render by spreading the inflight stroke into state
          setStrokes((s) => {
            if (!drawing.current) return s;
            const others = s.filter((x) => x !== drawing.current);
            return [...others, drawing.current];
          });
        }}
        onPointerUp={() => { drawing.current = null; }}
      >
        {strokes.map((s, i) => (
          <polyline
            key={i}
            points={s.points.map((p) => `${p.x + pad},${p.y + pad}`).join(" ")}
            fill="none"
            stroke="#2563eb"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}
