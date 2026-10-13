import { useEffect, useRef, useState } from "react";
import { niceStep, type ParsedEquation } from "@/lib/graphApp/math";
import { clampScale, fitBounds, type PlotBounds } from "@/lib/graphApp/framing";

export const CURVE_COLOURS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

export interface Item { id: string; eq: ParsedEquation; colour: string; hidden?: boolean }
export interface View2D { cx: number; cy: number; scale: number } // scale = px per unit
export const DEFAULT_VIEW: View2D = { cx: 0, cy: 0, scale: 40 };

interface Props {
  items: Item[];
  view: View2D;
  setView: (v: View2D | ((v: View2D) => View2D)) => void;
  grid: boolean; axes: boolean; labels: boolean;
  tool: string;
  onAddPoint: (x: number, y: number) => void;
  framing?: { bounds: PlotBounds; revision: number };
}

export default function Graph2D({ items, view, setView, grid, axes, labels, tool, onAddPoint, framing }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [sensor, setSensor] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (framing && size.w > 0 && size.h > 0) setView(fitBounds(framing.bounds, size.w, size.h));
  }, [framing, size, setView]);

  const toData = (px: number, py: number, v = viewRef.current) => ({
    x: v.cx + (px - size.w / 2) / v.scale,
    y: v.cy - (py - size.h / 2) / v.scale,
  });

  // Draw
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr; c.height = size.h * dpr;
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, size.w, size.h);
    const { cx, cy, scale } = view;
    const sx = (x: number) => size.w / 2 + (x - cx) * scale;
    const sy = (y: number) => size.h / 2 - (y - cy) * scale;
    const x0 = cx - size.w / 2 / scale, x1 = cx + size.w / 2 / scale;
    const y0 = cy - size.h / 2 / scale, y1 = cy + size.h / 2 / scale;
    const step = niceStep(x1 - x0, Math.max(6, size.w / 80));
    if (grid) {
      g.lineWidth = 1;
      for (const [s, a] of [[step / 5, 0.06], [step, 0.16]] as const) {
        g.strokeStyle = `rgba(15,23,42,${a})`;
        g.beginPath();
        for (let x = Math.ceil(x0 / s) * s; x <= x1; x += s) { g.moveTo(sx(x), 0); g.lineTo(sx(x), size.h); }
        for (let y = Math.ceil(y0 / s) * s; y <= y1; y += s) { g.moveTo(0, sy(y)); g.lineTo(size.w, sy(y)); }
        g.stroke();
      }
    }
    const ax = Math.min(Math.max(sy(0), 0), size.h), ay = Math.min(Math.max(sx(0), 0), size.w);
    if (axes) {
      g.strokeStyle = "#0f172a"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, ax); g.lineTo(size.w, ax); g.moveTo(ay, 0); g.lineTo(ay, size.h); g.stroke();
    }
    if (labels) {
      g.fillStyle = "#334155"; g.font = "12px system-ui, sans-serif";
      const fmt = (n: number) => String(+n.toFixed(6));
      g.textAlign = "center"; g.textBaseline = "top";
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) if (Math.abs(x) > step / 2) g.fillText(fmt(x), sx(x), ax + 4);
      g.textAlign = "right"; g.textBaseline = "middle";
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) if (Math.abs(y) > step / 2) g.fillText(fmt(y), ay - 4, sy(y));
      g.font = "italic 14px serif"; g.fillText("x", size.w - 6, ax - 10); g.textAlign = "left"; g.fillText("y", ay + 6, 12);
    }
    for (const it of items) {
      if (it.hidden) continue;
      g.strokeStyle = it.colour; g.fillStyle = it.colour; g.lineWidth = 2.25;
      if (it.eq.kind === "curve2d") {
        const f = it.eq.f;
        g.beginPath();
        let pen = false, lastY = 0;
        for (let px = 0; px <= size.w; px += 1) {
          const x = x0 + px / scale, y = f({ x });
          const py = sy(y);
          if (!Number.isFinite(y) || (pen && Math.abs(py - lastY) > size.h * 2)) { pen = false; continue; }
          if (pen) g.lineTo(px, py); else g.moveTo(px, py);
          pen = true; lastY = py;
        }
        g.stroke();
      } else if (it.eq.kind === "implicit2d") {
        const f = it.eq.f;
        const stepPx = 6;
        g.beginPath();
        for (let px = 0; px < size.w; px += stepPx) for (let py = 0; py < size.h; py += stepPx) {
          const corners = [[px, py], [px + stepPx, py], [px + stepPx, py + stepPx], [px, py + stepPx]];
          const values = corners.map(([u, v]) => f({ x: cx + (u - size.w / 2) / scale, y: cy - (v - size.h / 2) / scale }));
          const hits: Array<[number, number]> = [];
          for (let k = 0; k < 4; k++) {
            const j = (k + 1) % 4, a = values[k], b = values[j];
            if (!Number.isFinite(a) || !Number.isFinite(b) || (a !== 0 && a * b >= 0) || a === b) continue;
            const t = a / (a - b);
            hits.push([corners[k][0] + t * (corners[j][0] - corners[k][0]), corners[k][1] + t * (corners[j][1] - corners[k][1])]);
          }
          for (let k = 0; k + 1 < hits.length; k += 2) { g.moveTo(...hits[k]); g.lineTo(...hits[k + 1]); }
        }
        g.stroke();
      } else if (it.eq.kind === "parametric" && it.eq.dimension === 2) {
        g.beginPath(); let pen = false;
        for (let t = -4 * Math.PI; t <= 4 * Math.PI; t += 0.015) {
          const x = it.eq.fx({ t }), y = it.eq.fy({ t });
          if (!Number.isFinite(x) || !Number.isFinite(y)) { pen = false; continue; }
          if (pen) g.lineTo(sx(x), sy(y)); else g.moveTo(sx(x), sy(y));
          pen = true;
        }
        g.stroke();
      } else if (it.eq.kind === "point2d") {
        const [x, y] = it.eq.p;
        g.beginPath(); g.arc(sx(x), sy(y), 5, 0, Math.PI * 2); g.fill();
        g.font = "13px system-ui"; g.textAlign = "left"; g.fillText(`(${x}, ${y})`, sx(x) + 8, sy(y) - 8);
      }
    }
  }, [items, view, size, grid, axes, labels]);

  // Wheel zoom (anchored at cursor, magnitude-based)
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setView((v) => {
        const scale = clampScale(v.scale * Math.exp(-dy * 0.0015));
        const d = toData(px, py, v);
        return { scale, cx: d.x - (px - r.width / 2) / scale, cy: d.y + (py - r.height / 2) / scale };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // Pointer pan + pinch
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    down.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const el = canvas.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const prev = pointers.current.get(e.pointerId);
    if (!prev) {
      const d = toData(px, py);
      const curve = items.find((i) => !i.hidden && i.eq.kind === "curve2d");
      if (curve && curve.eq.kind === "curve2d") {
        const y = curve.eq.f({ x: d.x });
        if (Number.isFinite(y)) setSensor({ x: d.x, y, px, py: size.h / 2 - (y - view.cy) * view.scale });
      }
      return;
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...pointers.current.values()];
      const after = Math.hypot(c.x - d.x, c.y - d.y);
      if (before > 0) setView((v) => ({ ...v, scale: clampScale(v.scale * (after / before)) }));
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (down.current && Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 4) down.current.moved = true;
    setView((v) => ({ ...v, cx: v.cx - dx / v.scale, cy: v.cy + dy / v.scale }));
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (down.current && !down.current.moved && tool === "point") {
      const el = canvas.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = toData(e.clientX - r.left, e.clientY - r.top);
      onAddPoint(Math.round(d.x * 10) / 10, Math.round(d.y * 10) / 10);
    }
    down.current = null;
  };

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden rounded-xl">
      <canvas
        ref={canvas}
        className="h-full w-full touch-none cursor-crosshair"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onPointerLeave={() => setSensor(null)}
      />
      {sensor && (
        <div className="pointer-events-none absolute" style={{ left: sensor.px, top: sensor.py }}>
          <div className="-ml-1.5 -mt-1.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
          <div className="ml-2 -mt-8 whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-xs text-background">
            ({sensor.x.toFixed(2)}, {sensor.y.toFixed(2)})
          </div>
        </div>
      )}
    </div>
  );
}
