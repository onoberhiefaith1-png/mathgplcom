import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  FLOATING_SIZE_DEFAULT,
  clampFloatingSize,
  maxFloatingSizeFor,
  readFloatingSize,
  stepFloatingSize,
  subscribeFloatingSize,
  writeFloatingSize,
} from "@/lib/smartboard/floatingNumberSize";

/** "Screen" = the viewport; the cap uses its smaller side (see floatingNumberSize.ts). */
const screenMax = () => (typeof window === "undefined"
  ? maxFloatingSizeFor(1024, 768)
  : maxFloatingSizeFor(window.innerWidth, window.innerHeight));

/** Floating Number Size (§8–§10): the saved scale, capped at one third of the screen. */
export function useFloatingNumberSize() {
  const saved = useSyncExternalStore(subscribeFloatingSize, readFloatingSize, () => FLOATING_SIZE_DEFAULT);
  const [max, setMax] = useState(screenMax);
  useEffect(() => {
    const onResize = () => setMax(screenMax());
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  const scale = clampFloatingSize(saved, max);
  const bigger = useCallback(() => writeFloatingSize(stepFloatingSize(scale, 1, max)), [scale, max]);
  const smaller = useCallback(() => writeFloatingSize(stepFloatingSize(scale, -1, max)), [scale, max]);
  const reset = useCallback(() => writeFloatingSize(FLOATING_SIZE_DEFAULT), []);
  return {
    scale,
    max,
    canGrow: stepFloatingSize(scale, 1, max) !== scale,
    canShrink: stepFloatingSize(scale, -1, max) !== scale,
    bigger,
    smaller,
    reset,
  } as const;
}
