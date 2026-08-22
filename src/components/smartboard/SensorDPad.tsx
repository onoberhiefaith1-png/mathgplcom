// SensorDPad — the permanent Sensor Controller. A fixed viewport
// D-pad (▲ ◀ ● ▶ ▼) that ONLY moves the writing sensor. It never
// changes the active Floating Number line. Rendered via portal at
// bottom-center so it survives any board zoom / filter transforms.
//
// Chrome: no card, no background, no border — the five arrow
// buttons float directly on the screen so the pad blends in.
//
// Auto-hide: after SENSOR_IDLE_MS with no press and no pointer
// activity inside a small hot-zone around the pad, it fades out.
// Any pointer / wheel / touch inside the hot-zone brings it back
// and resets the timer.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useSmartboardRoot } from "./SmartboardRoot";
import { registerInteractionResetter } from "@/lib/stability/interactionReset";

interface Props {
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  ink?: string;
  canUp?: boolean;
  canDown?: boolean;
  canLeft?: boolean;
  canRight?: boolean;
  /** CSS bottom offset in px — leave room for the BottomPanel. */
  bottomPx?: number;
}

const HOLD_DELAY_MS = 350;
const REPEAT_MS = 90;
const SENSOR_IDLE_MS = 50_000;
// Half-width/height of the invisible activity hot-zone centred on the pad.
const HOT_ZONE_HALF = 140;
const DRAG_KEY = "sb.sensorDPad.offset";

export const SensorDPad = ({
  onUp, onDown, onLeft, onRight,
  chromeBg, chromeFg, chromeBorder, ink,
  canUp = true, canDown = true, canLeft = true, canRight = true,
  bottomPx = 96,
}: Props) => {
  const sbRoot = useSmartboardRoot();
  const holdRef = useRef<{ timer: number | null; interval: number | null }>({ timer: null, interval: null });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(true);
  // Drag offset applied on top of the default bottom-centre position. The pad
  // keeps its design and behaviour; only its resting place moves so it can sit
  // under one thumb on a phone. Persisted for the session.
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAG_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { x?: number; y?: number };
        setOffset({ x: Number(p.x) || 0, y: Number(p.y) || 0 });
      }
    } catch { /* ignore */ }
  }, []);

  const clearHold = useCallback(() => {
    if (holdRef.current.timer != null) window.clearTimeout(holdRef.current.timer);
    if (holdRef.current.interval != null) window.clearInterval(holdRef.current.interval);
    holdRef.current = { timer: null, interval: null };
  }, []);

  const kickIdle = useCallback(() => {
    if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setVisible(false), SENSOR_IDLE_MS);
  }, []);

  // Kick the idle timer whenever the pad becomes visible.
  useEffect(() => {
    if (visible) kickIdle();
    return () => {
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
    };
  }, [visible, kickIdle]);

  // Window-level activity listener. Revive + reset only when the pointer
  // is inside the pad's local hot-zone, so ordinary writing on the far
  // side of the board doesn't keep it awake forever.
  useEffect(() => {
    const inHotZone = (x: number, y: number) => {
      const el = wrapRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return (
        Math.abs(x - cx) <= HOT_ZONE_HALF + r.width / 2 &&
        Math.abs(y - cy) <= HOT_ZONE_HALF + r.height / 2
      );
    };
    const onPointer = (e: PointerEvent | MouseEvent | WheelEvent) => {
      if (!inHotZone(e.clientX, e.clientY)) return;
      setVisible(true);
      kickIdle();
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0] ?? e.changedTouches[0];
      if (!t) return;
      if (!inHotZone(t.clientX, t.clientY)) return;
      setVisible(true);
      kickIdle();
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("wheel", onPointer, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("wheel", onPointer);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [kickIdle]);

  useEffect(() => () => clearHold(), [clearHold]);

  useEffect(
    () => registerInteractionResetter(() => {
      dragRef.current = null;
      clearHold();
    }),
    [clearHold],
  );

  const startHold = useCallback((fn: () => void) => {
    fn();
    kickIdle();
    setVisible(true);
    clearHold();
    holdRef.current.timer = window.setTimeout(() => {
      holdRef.current.interval = window.setInterval(() => { fn(); kickIdle(); }, REPEAT_MS);
    }, HOLD_DELAY_MS);
  }, [clearHold, kickIdle]);

  const btn = (
    enabled: boolean,
    fn: () => void,
    icon: React.ReactNode,
    label: string,
  ) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!enabled}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!enabled) return;
        (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
        startHold(fn);
      }}
      onPointerUp={(e) => { e.stopPropagation(); clearHold(); }}
      onPointerCancel={() => clearHold()}
      onPointerLeave={() => clearHold()}
      className="grid place-items-center rounded-full transition-all"
      style={{
        width: 40, height: 40,
        background: `${chromeBg}`,
        color: chromeFg,
        border: `1px solid ${chromeBorder}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        opacity: enabled ? 0.7 : 0.22,
        cursor: "default",
      }}
    >
      {icon}
    </button>
  );

  const dpad = (
    <div
      ref={wrapRef}
      data-sb-chrome
      aria-label="Sensor controller"
      className="absolute z-40"
      style={{
        left: "50%",
        bottom: bottomPx,
        transform: `translateX(-50%) translate(${offset.x}px, ${offset.y}px)`,
        userSelect: "none",
        pointerEvents: visible ? "auto" : "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 250ms ease",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: "40px 40px 40px",
          gridTemplateRows: "40px 40px 40px",
          background: "transparent",
        }}
      >
        <div />
        <div className="grid place-items-center">
          {btn(canUp, onUp, <ChevronUp className="h-5 w-5" />, "Sensor up")}
        </div>
        <div />
        <div className="grid place-items-center">
          {btn(canLeft, onLeft, <ChevronLeft className="h-5 w-5" />, "Sensor left")}
        </div>
        <div
          role="button"
          tabIndex={-1}
          aria-label="Drag sensor controller"
          title="Drag to move"
          className="grid place-items-center"
          style={{ opacity: 0.35, touchAction: "none", cursor: "default" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
            setVisible(true);
            kickIdle();
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d) return;
            const half = window.innerWidth / 2 - 70;
            const x = Math.max(-half, Math.min(half, d.ox + (e.clientX - d.startX)));
            const maxUp = Math.max(0, window.innerHeight - 180);
            const y = Math.max(-maxUp, Math.min(120, d.oy + (e.clientY - d.startY)));
            setOffset({ x, y });
            kickIdle();
          }}
          onPointerUp={(e) => {
            dragRef.current = null;
            (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
            try { sessionStorage.setItem(DRAG_KEY, JSON.stringify(offset)); } catch { /* ignore */ }
          }}
          onPointerCancel={(e) => {
            dragRef.current = null;
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
            } catch {
              // Global recovery may already have released it.
            }
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: ink ?? chromeFg,
            }}
          />
        </div>
        <div className="grid place-items-center">
          {btn(canRight, onRight, <ChevronRight className="h-5 w-5" />, "Sensor right")}
        </div>
        <div />
        <div className="grid place-items-center">
          {btn(canDown, onDown, <ChevronDown className="h-5 w-5" />, "Sensor down")}
        </div>
        <div />
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dpad, sbRoot ?? document.body);
};

export default SensorDPad;
