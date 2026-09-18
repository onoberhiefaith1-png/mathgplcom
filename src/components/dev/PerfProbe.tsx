// Measures the real renderer: frame time, draw calls, triangles, loop count.
// Mounted inside the canvas in development only.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { registerLoop, setPerf } from "@/lib/slate/vfx/perf";

export function PerfProbe() {
  const gl = useThree((state) => state.gl);
  const samples = useRef<number[]>([]);
  const last = useRef(0);

  useEffect(() => registerLoop(), []);

  useFrame(() => {
    const now = performance.now();
    if (last.current) {
      const delta = now - last.current;
      const list = samples.current;
      list.push(delta);
      if (list.length > 90) list.shift();
      if (list.length % 15 === 0) {
        const sorted = [...list].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
        const worst = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
        setPerf({
          frameMs: Math.round(median * 10) / 10,
          fps: median > 0 ? Math.round(1000 / median) : 0,
          worstMs: Math.round(worst * 10) / 10,
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
        });
      }
    }
    last.current = now;
  });

  return null;
}
