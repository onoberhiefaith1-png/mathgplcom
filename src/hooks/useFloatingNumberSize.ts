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

const viewportWidth = () => (typeof window === "undefined" ? 1024 : window.innerWidth);

/** Floating Number Size (§8–§10): the saved scale, capped to what fits this screen. */
export function useFloatingNumberSize() {
  const saved = useSyncExternalStore(subscribeFloatingSize, readFloatingSize, () => FLOATING_SIZE_DEFAULT);
  const [max, setMax] = useState(() => maxFloatingSizeFor(viewportWidth()));
  useEffect(() => {
    const onResize = () => setMax(maxFloatingSizeFor(viewportWidth()));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
