// SensorDPad — the permanent Sensor Controller. A fixed viewport
// D-pad (▲ ◀ ● ▶ ▼) that ONLY moves the writing sensor. It never
// changes the active Floating Number line. Rendered via portal at
// bottom-center so it survives any board zoom / filter transforms.
//
// Boundaries (blocked movement / hold-to-repeat halt) are enforced
// by the caller via canUp / canDown / canLeft / canRight.

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

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

export const SensorDPad = ({
  onUp, onDown, onLeft, onRight,
  chromeBg, chromeFg, chromeBorder, ink,
  canUp = true, canDown = true, canLeft = true, canRight = true,
  bottomPx = 96,
}: Props) => {
  const holdRef = useRef<{ timer: number | null; interval: number | null }>({ timer: null, interval: null });

  const clear = useCallback(() => {
    if (holdRef.current.timer != null) window.clearTimeout(holdRef.current.timer);
    if (holdRef.current.interval != null) window.clearInterval(holdRef.current.interval);
    holdRef.current = { timer: null, interval: null };
  }, []);

  useEffect(() => () => clear(), [clear]);

  const startHold = useCallback((fn: () => void) => {
    fn();
    clear();
    holdRef.current.timer = window.setTimeout(() => {
      holdRef.current.interval = window.setInterval(fn, REPEAT_MS);
    }, HOLD_DELAY_MS);
  }, [clear]);

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
      onPointerUp={(e) => { e.stopPropagation(); clear(); }}
      onPointerCancel={() => clear()}
      onPointerLeave={() => clear()}
      className="grid place-items-center rounded-full border transition-all"
      style={{
        width: 44, height: 44,
        background: chromeBg,
        color: chromeFg,
        borderColor: chromeBorder,
        boxShadow: "0 2px 10px rgba(0,0,0,0.16)",
        backdropFilter: "blur(10px)",
        opacity: enabled ? 0.95 : 0.28,
        cursor: enabled ? "pointer" : "not-allowed",
      }}
    >
      {icon}
    </button>
  );

  const dpad = (
    <div
      data-sb-chrome
      aria-label="Sensor controller"
      className="fixed z-40"
      style={{
        left: "50%",
        bottom: bottomPx,
        transform: "translateX(-50%)",
        userSelect: "none",
        pointerEvents: "auto",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: "44px 44px 44px",
          gridTemplateRows: "44px 44px 44px",
          padding: 8,
          borderRadius: 20,
          background: chromeBg,
          border: `1px solid ${chromeBorder}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
          backdropFilter: "blur(10px)",
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
          aria-hidden
          className="grid place-items-center"
          style={{ opacity: 0.5 }}
        >
          <span
            style={{
              width: 10, height: 10, borderRadius: "50%",
              background: ink ?? chromeFg,
              opacity: 0.6,
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
  return createPortal(dpad, document.body);
};

export default SensorDPad;
