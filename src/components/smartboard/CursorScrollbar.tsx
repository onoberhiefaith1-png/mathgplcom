// CursorScrollbar — dedicated vertical ↑/↓ controller for the writing
// sensor. Independent from the Floating Number panel's line navigator:
// it ONLY moves the sensor, never changes which floating-number set is
// shown. Press-and-hold auto-repeats. All movement rules (locked-row
// skip, active-band clamp, 3-row slack) are enforced by the caller
// inside onUp / onDown.

import { useCallback, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface Props {
  onUp: () => void;
  onDown: () => void;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  /** Distance from the left edge in CSS px. */
  leftPx?: number;
  /** Vertical center as a CSS top value (e.g. "50%"). */
  topCss?: string;
  canUp?: boolean;
  canDown?: boolean;
  /** When true, render as an inline flex group (no absolute positioning),
   *  so it can sit inside an existing rail. */
  inline?: boolean;
}


const HOLD_DELAY_MS = 350;
const REPEAT_MS = 90;

export const CursorScrollbar = ({
  onUp,
  onDown,
  chromeBg,
  chromeFg,
  chromeBorder,
  leftPx = 12,
  topCss = "50%",
  canUp = true,
  canDown = true,
  inline = false,
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
        width: 40, height: 40,
        background: chromeBg,
        color: chromeFg,
        borderColor: chromeBorder,
        boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
        backdropFilter: "blur(10px)",
        opacity: enabled ? 0.95 : 0.3,
        cursor: enabled ? "pointer" : "not-allowed",
      }}
    >
      {icon}
    </button>
  );

  if (inline) {
    return (
      <div
        className="flex flex-col items-center gap-2"
        style={{ userSelect: "none" }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Writing cursor controller"
      >
        {btn(canUp, onUp, <ChevronUp className="h-5 w-5" />, "Cursor up")}
        {btn(canDown, onDown, <ChevronDown className="h-5 w-5" />, "Cursor down")}
      </div>
    );
  }

  return (
    <div
      data-sb-chrome
      className="absolute z-30 flex flex-col items-center gap-2"
      style={{
        left: leftPx,
        top: topCss,
        transform: "translateY(-50%)",
        userSelect: "none",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Writing cursor controller"
    >
      {btn(canUp, onUp, <ChevronUp className="h-5 w-5" />, "Cursor up")}
      {btn(canDown, onDown, <ChevronDown className="h-5 w-5" />, "Cursor down")}
    </div>
  );
};

export default CursorScrollbar;

