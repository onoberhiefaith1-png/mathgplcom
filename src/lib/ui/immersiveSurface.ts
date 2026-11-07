// IMMERSIVE SURFACE — the Smartboard and active Game play claim the whole
// screen. While one is mounted, app-wide chrome that floats over pages (the
// light/dark toggle, the colour palette and the tutorial video launcher) steps
// aside. It is a mount-scoped claim, not a route list: the controls come back
// the moment the board/game unmounts, and every other page keeps them.

import { useEffect, useSyncExternalStore } from "react";

let claims = 0;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export const claimImmersiveSurface = (): (() => void) => {
  claims += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    claims = Math.max(0, claims - 1);
    emit();
  };
};

export const isImmersiveSurfaceActive = (): boolean => claims > 0;

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** True while a Smartboard or active Game is on screen. */
export const useImmersiveSurfaceActive = (): boolean =>
  useSyncExternalStore(subscribe, isImmersiveSurfaceActive, () => false);

/** Mount in the Smartboard / active Game: hides the global page chrome while mounted. */
export const useClaimImmersiveSurface = (active = true): void => {
  useEffect(() => (active ? claimImmersiveSurface() : undefined), [active]);
};
