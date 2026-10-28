// A per-line MM:SS time control. Two independent numeric fields with their own
// up/down steppers, always showing a value (00:00 when there is no time).
//
// The value is whole seconds and every adjustment is reported immediately, so
// the owner of the value (a Floating Numbers line) persists it right away
// instead of keeping it in temporary screen state.

import { ChevronDown, ChevronUp } from "lucide-react";
import type { CSSProperties } from "react";

/** Exactly sixty minutes is the largest time a line may hold. */
export const MAX_LINE_SECONDS = 60 * 60;

interface Props {
  /** Whole seconds. 0 (or null/undefined) means no time on this line. */
  value: number | null | undefined;
  onChange: (seconds: number) => void;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/** Keeps any pair of values inside 00:00 … 60:00. */
export const clampMinuteSecond = (minutes: number, seconds: number): number => {
  const m = Math.min(60, Math.max(0, Math.floor(Number(minutes) || 0)));
  const s = Math.min(59, Math.max(0, Math.floor(Number(seconds) || 0)));
  return Math.min(MAX_LINE_SECONDS, m * 60 + s);
};

export const MinuteSecondInput = ({
  value, onChange, title, className, style,
}: Props) => {
  const total = Math.min(MAX_LINE_SECONDS, Math.max(0, Math.floor(Number(value) || 0)));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  const setMinutes = (next: number) => onChange(clampMinuteSecond(next, seconds));
  const setSeconds = (next: number) => {
    // 59 → 60 rolls into the next minute; 0 → -1 borrows from it. The total can
    // never pass 60:00, so 60:01 and 60:60 are impossible.
    if (next > 59) return onChange(clampMinuteSecond(minutes + 1, next - 60));
    if (next < 0) return minutes > 0 ? onChange(clampMinuteSecond(minutes - 1, 60 + next)) : onChange(clampMinuteSecond(minutes, 0));
    return onChange(clampMinuteSecond(minutes, next));
  };

  const fieldStyle: CSSProperties = {
    background: "hsl(200 60% 50% / 0.12)",
    border: "1px solid hsl(200 60% 40% / 0.45)",
    color: "hsl(220 35% 18%)",
    ...style,
  };
  // The steppers carry the page's own ink so they stay clearly visible on the
  // light paper panel instead of fading into it.
  const stepClass =
    "flex h-3.5 w-4 items-center justify-center rounded-[3px] disabled:opacity-30";
  const stepStyle: CSSProperties = {
    background: "hsl(200 60% 50% / 0.16)",
    border: "1px solid hsl(200 60% 40% / 0.55)",
    color: "hsl(220 35% 18%)",
  };

  const part = (
    label: string,
    partValue: number,
    max: number,
    commit: (next: number) => void,
  ) => (
    <div className="flex items-center gap-0.5">
      <input
        type="number"
        min={0}
        max={max}
        value={String(partValue).padStart(2, "0")}
        aria-label={label}
        title={label}
        onChange={(event) => commit(Math.floor(Number(event.target.value) || 0))}
        className="w-9 text-center text-[13px] tabular-nums rounded-md px-1 py-0.5 outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        style={fieldStyle}
      />
      <div className="flex flex-col gap-[1px]">
        <button
          type="button"
          className={stepClass}
          style={stepStyle}
          title={`${label} up`}
          aria-label={`${label} up`}
          onClick={() => commit(partValue + 1)}
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          className={stepClass}
          style={stepStyle}
          title={`${label} down`}
          aria-label={`${label} down`}
          disabled={partValue === 0 && label === "Minutes" && seconds === 0}
          onClick={() => commit(partValue - 1)}
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`inline-flex items-center gap-1 ${className ?? ""}`}
      title={title ?? "Time for this line only (MM:SS), up to 60:00"}
      onClick={(event) => event.stopPropagation()}
    >
      {part("Minutes", minutes, 60, setMinutes)}
      <span className="text-[14px] tabular-nums" style={{ color: "hsl(220 35% 18%)" }}>:</span>
      {part("Seconds", seconds, 59, setSeconds)}
    </div>
  );
};

export default MinuteSecondInput;
