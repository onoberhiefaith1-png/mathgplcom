// Live Sensor orb + Trail. Not a video: drawn every frame from the Sensor's
// position. Trail grows while moving, shrinks progressively after 5s idle,
// and grows back (never pops) when movement resumes.
import { useEffect, useRef } from "react";
import { IDLE_MS, type TrailSettings } from "@/lib/flow/types";

interface Props {
  active: boolean;
  settings: TrailSettings;
  /** Returns the sensor's viewport position, or null. */
  getPoint: () => { x: number; y: number } | null;
  /** Contained preview mode (fills parent, uses its own getPoint coords). */
  contained?: boolean;
}

export const FlowTrail = ({ active, settings, getPoint, contained }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const sRef = useRef(settings);
  sRef.current = settings;
  const gRef = useRef(getPoint);
  gRef.current = getPoint;

  useEffect(() => {
    if (!active) return;
    const pts: { x: number; y: number }[] = [];
    let visible = 0; // number of points currently shown (grows/shrinks)
    let lastMove = performance.now();
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const c = ref.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== Math.round(rect.width * dpr)) { c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr); }
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const s = sRef.current;
      const maxPts = Math.round(15 + s.length * 185);
      const p0 = gRef.current();
      if (!p0) return;
      const p = contained ? p0 : { x: p0.x - rect.left, y: p0.y - rect.top };
      const prev = pts[pts.length - 1];
      const moving = !prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.6;
      if (moving) {
        if (visible < 1 && pts.length) pts.length = 0; // fully gone → start fresh
        pts.push(p);
        if (pts.length > maxPts) pts.splice(0, pts.length - maxPts);
        lastMove = now;
      }
      const idle = now - lastMove > IDLE_MS;
      const growRate = maxPts / 0.8; // points per second while growing
      const shrinkRate = maxPts / Math.max(0.2, s.fadeSec);
      if (idle) visible = Math.max(0, visible - shrinkRate * dt);
      else visible = Math.min(pts.length, visible + growRate * dt);

      const n = Math.floor(Math.min(visible, pts.length));
      const seg = pts.slice(pts.length - n);
      const thick = 2 + s.thickness * 14;
      const t = now / 1000;
      if (seg.length > 1) {
        ctx.lineCap = "round";
        ctx.shadowColor = s.color;
        ctx.shadowBlur = s.glow * 30;
        for (let i = 1; i < seg.length; i++) {
          const k = i / seg.length;
          const a = seg[i - 1], b = seg[i];
          const nx = -(b.y - a.y), ny = b.x - a.x;
          const len = Math.hypot(nx, ny) || 1;
          const off = Math.sin(t * 12 + i * 0.5) * s.vibration * 4 * k;
          ctx.strokeStyle = s.color;
          ctx.globalAlpha = k * 0.9;
          ctx.lineWidth = thick * (0.2 + 0.8 * k);
          ctx.beginPath();
          ctx.moveTo(a.x + (nx / len) * off, a.y + (ny / len) * off);
          ctx.lineTo(b.x + (nx / len) * off, b.y + (ny / len) * off);
          ctx.stroke();
        }
      }
      // Sensor orb.
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 10 + s.glow * 30;
      ctx.shadowColor = s.color;
      const r = 6 + s.thickness * 6;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, s.color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      const c = ref.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      // The drawing loop scales the context for device pixels. Reset that
      // transform before clearing so teardown removes the full backing store,
      // including the final composited segment at high device-pixel ratios.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };
  }, [active, contained]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={contained ? "absolute inset-0 h-full w-full" : "pointer-events-none fixed inset-0 h-screen w-screen"}
      style={{ zIndex: contained ? undefined : 60 }}
    />
  );
};

export default FlowTrail;
