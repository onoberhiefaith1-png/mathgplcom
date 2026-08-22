/**
 * Canvas-scoped hover cursor for 3D scenes.
 *
 * Scenes must never write `document.body.style.cursor`: if the graphics context
 * drops or the scene unmounts while the pointer is over a hotspot, the matching
 * pointer-out never fires and the whole page is left on a hand cursor with a
 * dead scene underneath. Scoping the cursor to the canvas — and always clearing
 * it on unmount — makes that state impossible to leak.
 *
 * Must be called inside a <Canvas> subtree.
 */
import { useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { setScopedCursor } from "./interactionReset";

export function useSceneCursor() {
  const canvas = useThree((state) => state.gl.domElement);

  const setCursor = useCallback(
    (cursor: "pointer" | "default") => setScopedCursor(canvas, cursor),
    [canvas],
  );

  // Unmount, context loss and page teardown all land here.
  useEffect(() => {
    const reset = () => setScopedCursor(canvas, "default");
    canvas.addEventListener("webglcontextlost", reset);
    canvas.addEventListener("pointerleave", reset);
    return () => {
      canvas.removeEventListener("webglcontextlost", reset);
      canvas.removeEventListener("pointerleave", reset);
      reset();
    };
  }, [canvas]);

  return setCursor;
}
