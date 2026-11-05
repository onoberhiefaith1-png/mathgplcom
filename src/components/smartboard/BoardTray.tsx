// Writing tray on the Smartboard. It follows the pointer (and the writing
// caret until the pointer moves). Flow no longer owns this ribbon.
import { useCallback, useEffect, useRef } from "react";
import FlowTrail from "@/components/flow/FlowTrail";
import { trayIsActive, trayToTrail, type TraySettings } from "@/lib/smartboard/traySettings";

export function BoardTray({ settings, inSolution }: { settings: TraySettings; inSolution: boolean }) {
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const on = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", on);
    return () => window.removeEventListener("pointermove", on);
  }, []);
  const getPoint = useCallback(() => {
    if (pointer.current) return pointer.current;
    const el = document.querySelector(".sb-sensor") as HTMLElement | null;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);
  if (!trayIsActive(settings, inSolution)) return null;
  return <FlowTrail active settings={trayToTrail(settings)} getPoint={getPoint} />;
}

export default BoardTray;
