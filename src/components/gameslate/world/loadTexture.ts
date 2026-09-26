// Non-blocking texture loading for the writing surfaces.
//
// The board used to load its artwork through drei's `useTexture`, which
// suspends the whole slate. One slow or failed image therefore withheld every
// writing surface and left the asset-free placeholder on screen for good — the
// board looked like a row of blank white slabs that could not be clicked,
// written on, or scrolled.
//
// Here loading happens beside the render instead of in front of it: surfaces
// draw immediately, and each map is attached the moment its image arrives. A
// failed image simply never attaches; it can no longer take the board down.

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous");

const ready = new Map<string, THREE.Texture>();
const inflight = new Map<string, Promise<THREE.Texture | null>>();
const failed = new Set<string>();

/** Already-decoded texture for this url, if one exists. */
export const peekTexture = (url: string): THREE.Texture | undefined => ready.get(url);

/** Starts (or joins) a load. Resolves to null instead of throwing on failure. */
export function loadTexture(url: string): Promise<THREE.Texture | null> {
  const hit = ready.get(url);
  if (hit) return Promise.resolve(hit);
  if (failed.has(url)) return Promise.resolve(null);
  const pending = inflight.get(url);
  if (pending) return pending;
  const promise = new Promise<THREE.Texture | null>((resolve) => {
    loader.load(
      url,
      (texture) => {
        ready.set(url, texture);
        inflight.delete(url);
        resolve(texture);
      },
      undefined,
      () => {
        failed.add(url);
        inflight.delete(url);
        resolve(null);
      },
    );
  });
  inflight.set(url, promise);
  return promise;
}

/** Warms images in the background without blocking any render. */
export const preloadTextures = (urls: string[]) => {
  urls.forEach((url) => void loadTexture(url));
};

/**
 * Textures for `urls`, in order. Entries are `undefined` until their image has
 * arrived. This hook NEVER suspends and never throws.
 */
export function useAsyncTextures(urls: string[]): (THREE.Texture | undefined)[] {
  const key = urls.join("|");
  const list = useMemo(() => (key ? key.split("|") : []), [key]);
  const [, bump] = useState(0);

  useEffect(() => {
    let live = true;
    const missing = list.filter((url) => !ready.has(url) && !failed.has(url));
    if (missing.length === 0) return;
    void Promise.all(missing.map((url) => loadTexture(url))).then(() => {
      if (live) bump((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [list]);

  return useMemo(() => list.map((url) => ready.get(url)), [list, ready.size]);
}
