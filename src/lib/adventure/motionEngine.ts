import { useEffect, useRef, useState } from "react";
import type { EffectMotion } from "./types";

/** Returns animated dx/dy offsets in % of frame. */
export function useEffectMotion(motion: EffectMotion, enabled = true) {
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || motion.type === "static") { setOffset({ dx: 0, dy: 0 }); return; }
    startRef.current = performance.now();
    const tick = (now: number) => {
      const t = ((now - startRef.current) / 1000) * motion.speed;
      const a = motion.amplitude;
      let dx = 0, dy = 0;
      switch (motion.type) {
        case "left":  dx = -((t * a) % 100); break;
        case "right": dx =  ((t * a) % 100); break;
        case "up":    dy = -((t * a) % 100); break;
        case "down":  dy =  ((t * a) % 100); break;
        case "circle": dx = Math.cos(t) * a; dy = Math.sin(t) * a; break;
        case "figure8": dx = Math.sin(t) * a; dy = Math.sin(t * 2) * a * 0.5; break;
        case "random":
          dx = Math.sin(t * 1.3) * a * 0.5 + Math.cos(t * 0.7) * a * 0.5;
          dy = Math.cos(t * 1.1) * a * 0.5 + Math.sin(t * 0.5) * a * 0.5;
          break;
        case "path": {
          const pts = motion.path ?? [];
          if (pts.length >= 2) {
            const loop = pts.length;
            const pos = (t * 0.3) % loop;
            const i = Math.floor(pos);
            const f = pos - i;
            const a1 = pts[i], a2 = pts[(i + 1) % loop];
            dx = a1.x + (a2.x - a1.x) * f;
            dy = a1.y + (a2.y - a1.y) * f;
          }
          break;
        }
      }
      setOffset({ dx, dy });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [motion.type, motion.speed, motion.amplitude, motion.path, enabled]);

  return offset;
}
