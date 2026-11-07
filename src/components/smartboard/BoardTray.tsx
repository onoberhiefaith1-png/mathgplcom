// Writing tray on the Smartboard. It follows the pointer — mouse, pen AND
// finger — (and the writing caret until the pointer moves). It reuses the
// shared Flow ribbon renderer; nothing here draws its own trail.
import { useCallback, useEffect, useRef, useState } from "react";
import FlowTrail from "@/components/flow/FlowTrail";
import { trayIsActive, trayToTrail, type TraySettings } from "@/lib/smartboard/traySettings";

type Point = { x: number; y: number };

/**
 * Track the latest pointer position from mouse/pen/touch. Listeners are
 * passive and never call preventDefault, so writing and scrolling are never
 * blocked; touch events cover browsers that cancel pointer events on touch.
 */
export const usePointerFollower = (target: () => EventTarget | null = () => window) => {
  const pointer = useRef<Point | null>(null);
  useEffect(() => {
    const el = target();
    if (!el) return;
    const onPointer = (event: Event) => {
      const e = event as PointerEvent;
      pointer.current = { x: e.clientX, y: e.clientY };
    };
    const onTouch = (event: Event) => {
      const t = (event as TouchEvent).touches?.[0];
      if (t) pointer.current = { x: t.clientX, y: t.clientY };
    };
    const opts: AddEventListenerOptions = { passive: true };
    el.addEventListener("pointermove", onPointer, opts);
    el.addEventListener("pointerdown", onPointer, opts);
    el.addEventListener("touchstart", onTouch, opts);
    el.addEventListener("touchmove", onTouch, opts);
    return () => {
      el.removeEventListener("pointermove", onPointer, opts);
      el.removeEventListener("pointerdown", onPointer, opts);
      el.removeEventListener("touchstart", onTouch, opts);
      el.removeEventListener("touchmove", onTouch, opts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return pointer;
};

export function BoardTray({ settings, inSolution }: { settings: TraySettings; inSolution: boolean }) {
  const pointer = usePointerFollower();
  const getPoint = useCallback(() => {
    if (pointer.current) return pointer.current;
    const el = document.querySelector(".sb-sensor") as HTMLElement | null;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, [pointer]);
  if (!trayIsActive(settings, inSolution)) return null;
  return <FlowTrail active settings={trayToTrail(settings)} getPoint={getPoint} />;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Live preview under the tray settings: the SAME Flow ribbon with the current
 * values. It glides along a figure-of-eight on its own (paused for reduced
 * motion) and follows the mouse or finger while it is over the preview.
 */
export function TrayPreview({ settings, border }: { settings: TraySettings; border?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const hover = useRef<Point | null>(null);
  const lastHover = useRef(0);
  const [reduced] = useState(prefersReducedMotion);
  const getPoint = useCallback((): Point | null => {
    const el = box.current;
    if (!el) return null;
    const w = el.clientWidth || 240;
    const h = el.clientHeight || 96;
    if (hover.current && performance.now() - lastHover.current < 1500) return hover.current;
    if (reduced) return { x: w / 2, y: h / 2 };
    const t = performance.now() / 1000;
    return { x: w / 2 + Math.sin(t * 1.3) * (w * 0.36), y: h / 2 + Math.sin(t * 2.6) * (h * 0.28) };
  }, [reduced]);
  const track = (x: number, y: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    hover.current = { x: x - rect.left, y: y - rect.top };
    lastHover.current = performance.now();
  };
  return (
    <div
      ref={box}
      data-testid="tray-preview"
      aria-label="Trail preview"
      role="img"
      className="relative mt-2 h-24 w-full overflow-hidden rounded-md border"
      style={{ borderColor: border, touchAction: "none" }}
      onPointerMove={(e) => track(e.clientX, e.clientY)}
      onPointerDown={(e) => track(e.clientX, e.clientY)}
      onTouchMove={(e) => { const t = e.touches[0]; if (t) track(t.clientX, t.clientY); }}
    >
      <div className="absolute inset-0">
        <FlowTrail active contained settings={trayToTrail(settings)} getPoint={getPoint} />
      </div>
    </div>
  );
}

export default BoardTray;
