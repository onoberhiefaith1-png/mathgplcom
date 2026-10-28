/**
 * Load an optional picture for a 3D object without ever suspending the scene.
 * The frame or window is real geometry and must stand on the wall whether or
 * not a picture has been chosen, so a missing/failed image is simply "no map".
 */
import { useEffect, useState } from "react";
import * as THREE from "three";

export const useImageTexture = (url?: string | null): THREE.Texture | null => {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let cancelled = false;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (cancelled) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.ClampToEdgeWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        t.needsUpdate = true;
        loaded = t;
        setTex(t);
      },
      undefined,
      () => {
        if (!cancelled) setTex(null);
      },
    );
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [url]);

  return tex;
};

/**
 * Fit a picture inside a fixed opening the way a real mount does: fill the
 * opening and crop the overflow, never stretch the image out of shape.
 */
export const coverFit = (tex: THREE.Texture | null, width: number, height: number): void => {
  if (!tex?.image) return;
  const iw = (tex.image as { width?: number }).width ?? 1;
  const ih = (tex.image as { height?: number }).height ?? 1;
  const target = width / Math.max(height, 0.0001);
  const source = iw / Math.max(ih, 0.0001);
  if (source > target) {
    const r = target / source;
    tex.repeat.set(r, 1);
    tex.offset.set((1 - r) / 2, 0);
  } else {
    const r = source / target;
    tex.repeat.set(1, r);
    tex.offset.set(0, (1 - r) / 2);
  }
  tex.needsUpdate = true;
};

/**
 * Keep the crop correct after the picture finishes loading and whenever the
 * opening is resized, so a late image is never left stretched.
 */
export const useCoverFit = (tex: THREE.Texture | null, width: number, height: number): void => {
  useEffect(() => {
    coverFit(tex, width, height);
  }, [tex, width, height]);
};
