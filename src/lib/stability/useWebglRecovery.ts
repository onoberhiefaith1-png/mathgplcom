/**
 * Shared graphics-context recovery for every 3D surface.
 *
 * A lost WebGL context leaves a canvas painted but dead — the classic "the page
 * is there but nothing works". Blocking the default teardown lets the browser
 * restore the SAME context, so the scene resumes without a remount and without
 * a reload loop.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type WebglRecovery = {
  /** Pass to r3f `onCreated={({ gl }) => attach(gl.domElement)}` or a raw canvas. */
  attach: (canvas: HTMLCanvasElement) => void;
  /** False while the context is gone. Keep the last painted frame visible. */
  alive: boolean;
  /** Increments only if the browser never restored the context (last resort remount). */
  resetKey: number;
};

export function useWebglRecovery(label = "scene", restoreGraceMs = 3_000): WebglRecovery {
  const [alive, setAlive] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const remountedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const attach = useCallback(
    (canvas: HTMLCanvasElement) => {
      cleanupRef.current?.();
      let restoreTimer: number | undefined;

      const onLost = (event: Event) => {
        event.preventDefault(); // Keep the canvas so the browser can restore it.
        setAlive(false);
        console.warn(`[webgl:${label}] context lost — waiting for restore`);
        if (remountedRef.current) return;
        window.clearTimeout(restoreTimer);
        restoreTimer = window.setTimeout(() => {
          remountedRef.current = true; // Once only: never loss → remount → loss.
          setAlive(true);
          setResetKey((key) => key + 1);
        }, restoreGraceMs);
      };
      const onRestored = () => {
        window.clearTimeout(restoreTimer);
        setAlive(true);
      };

      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);
      cleanupRef.current = () => {
        window.clearTimeout(restoreTimer);
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
      };
    },
    [label, restoreGraceMs],
  );

  useEffect(() => () => cleanupRef.current?.(), []);

  return { attach, alive, resetKey };
}
