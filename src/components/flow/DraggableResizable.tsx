// Free move + resize wrapper for Flow items on the Smartboard. Compact controls
// sit on the item itself, appear when the pointer comes near, and hide after 5s.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GripHorizontal, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Placement { x: number; y: number; scale: number } // x,y = centre as viewport fractions

interface Props {
  value: Placement;
  min: number;
  max: number;
  editable: boolean;
  onChange: (p: Placement) => void;
  onCommit: (p: Placement) => void;
  children: ReactNode;
  label: string;
  /** Base box size in px at scale 1. */
  baseW: number;
  baseH: number;
  /** Character controls sit over the visible subject; standard controls sit above the item. */
  controls?: "above" | "subject-top";
}

export const DraggableResizable = ({ value, min, max, editable, onChange, onCommit, children, label, baseW, baseH, controls = "above" }: Props) => {
  const [show, setShow] = useState(false);
  const hideT = useRef<number>();
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(value);
  latest.current = value;

  const poke = useCallback(() => {
    setShow(true);
    window.clearTimeout(hideT.current);
    hideT.current = window.setTimeout(() => setShow(false), 5000);
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(hideT.current);
    setShow(false);
  }, []);

  useEffect(() => {
    if (!editable) return;
    if (controls === "above") poke();
    const near = (e: PointerEvent) => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const pad = 40;
      if (controls === "above" && e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad) poke();
    };
    const dismissOutside = (e: PointerEvent) => {
      if (controls !== "subject-top") return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("[data-flow-controls]")) return;
      if (!hitVisibleCanvas(e)) hide();
    };
    window.addEventListener("pointermove", near);
    window.addEventListener("pointerdown", dismissOutside, true);
    return () => {
      window.removeEventListener("pointermove", near);
      window.removeEventListener("pointerdown", dismissOutside, true);
      window.clearTimeout(hideT.current);
    };
  }, [controls, editable, hide, poke]);

  const clampScale = (s: number) => Math.min(max, Math.max(min, s));

  const hitVisibleCanvas = (e: Pick<PointerEvent, "clientX" | "clientY"> | Pick<React.PointerEvent, "clientX" | "clientY">) => {
    if (controls !== "subject-top") return true;
    const canvases = Array.from(box.current?.querySelectorAll("canvas") ?? []).reverse();
    for (const canvas of canvases) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) continue;
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((e.clientX - rect.left) * canvas.width / rect.width)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((e.clientY - rect.top) * canvas.height / rect.height)));
      try {
        const gl = canvas.getContext("webgl2");
        if (gl) {
          const pixel = new Uint8Array(4);
          gl.readPixels(x, canvas.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          if (pixel[3] > 12) return true;
        } else {
          const alpha = canvas.getContext("2d")?.getImageData(x, y, 1, 1).data[3] ?? 0;
          if (alpha > 12) return true;
        }
      } catch { return true; }
    }
    // Fallback: if no canvas could be read, accept taps in the central body area.
    const r = box.current?.getBoundingClientRect();
    if (r && !canvases.length) {
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      return fx > 0.25 && fx < 0.75 && fy > 0.15 && fy < 0.95;
    }
    return false;
  };

  const activate = (e: React.PointerEvent) => {
    if (hitVisibleCanvas(e)) poke();
  };

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, start = latest.current;
    const move = (ev: PointerEvent) => {
      poke();
      // Free movement across (and beyond) the whole screen — generous limits keep
      // the item retrievable without fencing it off at the edges.
      onChange({ ...start, x: Math.min(2, Math.max(-1, start.x + (ev.clientX - sx) / window.innerWidth)), y: Math.min(2, Math.max(-1, start.y + (ev.clientY - sy) / window.innerHeight)) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); onCommit(latest.current); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const zoom = (f: number) => { const p = { ...latest.current, scale: clampScale(latest.current.scale * f) }; onChange(p); onCommit(p); poke(); };

  const w = baseW * value.scale, h = baseH * value.scale;
  const itemTop = value.y * window.innerHeight - h / 2;
  const itemCenter = value.x * window.innerWidth;
  const controlsTop = controls === "subject-top"
    ? Math.min(window.innerHeight - 42, Math.max(8, itemTop + h * 0.55))
    : Math.max(8, itemTop - 36);
  const controlsLeft = Math.min(window.innerWidth - 104, Math.max(104, itemCenter));
  return (
    <div
      ref={box}
      data-sb-chrome
      className="fixed z-40 touch-none"
      onPointerDown={activate}
      onPointerEnter={controls === "above" ? poke : undefined}
      onFocusCapture={poke}
      style={{ left: `calc(${value.x * 100}vw - ${w / 2}px)`, top: `calc(${value.y * 100}vh - ${h / 2}px)`, width: w, height: h }}
    >
      {children}
      {editable && (
        <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}>
          <div
            data-flow-controls
            className="pointer-events-auto fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-background/90 px-1 py-0.5 shadow backdrop-blur"
            style={{
              left: controlsLeft,
              top: controlsTop,
              pointerEvents: show ? "auto" : "none",
            }}
          >
            <Button type="button" variant="ghost" size="icon" aria-label={`Move ${label}`} title={`Move ${label}`} onPointerDown={startDrag} className="h-7 w-7 cursor-grab touch-none rounded-full text-muted-foreground active:cursor-grabbing"><GripHorizontal className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Make ${label} smaller`} title={`Make ${label} smaller`} onClick={() => zoom(0.9)} className="h-7 w-7 rounded-full text-muted-foreground"><Minus className="h-3.5 w-3.5" /></Button>
            <span className="w-9 text-center text-[10px] tabular-nums text-muted-foreground">{Math.round(value.scale * 100)}%</span>
            <Button type="button" variant="ghost" size="icon" aria-label={`Make ${label} bigger`} title={`Make ${label} bigger`} onClick={() => zoom(1.1)} className="h-7 w-7 rounded-full text-muted-foreground"><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraggableResizable;
