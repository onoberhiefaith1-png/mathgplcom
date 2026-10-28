// LineStatusRail — vertical column of traffic-light bulbs anchored to the
// right edge of the writing surface. One bulb per non-empty handwritten
// line in the active example band, plus a single "overall" bulb at the
// top that turns blue when every guided line has been satisfied.
//
//  yellow  → line has ink but isn't yet a complete equation
//  green   → line matches the current or any other guided target
//            (also: a shuffled-but-mathematically-equivalent rephrasing)
//  red     → complete equation that doesn't match any guided line and
//            isn't equivalent to the previous handwritten line
//  blue    → all guided lines for the active problem are satisfied
//            (rendered on the top "overall" bulb only)

import type { Grid } from "@/lib/smartboard/grid";

export type LineBulb = "yellow" | "green" | "red";

interface Props {
  grid: Grid;
  /** Per-line bulb colour, keyed by integer line number. */
  statusByLine: Record<number, LineBulb>;
  /** Y of the active band's top (board pixels). */
  bandTopPx: number;
  /** Whole-problem completion. */
  allDone: boolean;
  /** Board-space distance from the chosen edge. */
  rightPx?: number;
  /** When set, anchor bulbs to the LEFT edge at this distance instead of the right. */
  leftPx?: number;
}

const COLORS: Record<LineBulb | "blue", string> = {
  yellow: "hsl(46 96% 60%)",
  green: "hsl(140 70% 50%)",
  red: "hsl(0 85% 62%)",
  blue: "hsl(200 95% 62%)",
};

const Bulb = ({
  color,
  top,
  pulse,
  rightPx,
  leftPx,
  label,
}: { color: string; top: number; pulse?: boolean; rightPx?: number; leftPx?: number; label: string }) => (
  <div
    aria-label={label}
    style={{
      position: "absolute",
      top,
      ...(leftPx != null ? { left: leftPx } : { right: rightPx ?? 18 }),
      width: 14,
      height: 14,
      borderRadius: 9999,
      background: color,
      boxShadow: `0 0 10px ${color}cc, 0 0 22px ${color}55`,
      pointerEvents: "none",
      animation: pulse ? "sb-bulb-pulse 1.4s ease-in-out infinite" : undefined,
      zIndex: 22,
    }}
  />
);

export const LineStatusRail = ({
  grid,
  statusByLine,
  bandTopPx,
  allDone,
  rightPx,
  leftPx,
}: Props) => {
  const lines = Object.keys(statusByLine)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  return (
    <>
      <style>{`
        @keyframes sb-bulb-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.18); opacity: 1; }
        }
      `}</style>
      {/* Overall problem completion bulb — sits just above the first line. */}
      {allDone && (
        <Bulb
          color={COLORS.blue}
          top={Math.max(0, bandTopPx - 22)}
          rightPx={rightPx}
          leftPx={leftPx}
          label="problem complete"
        />
      )}
      {lines.map((n) => {
        const status = statusByLine[n];
        const top =
          grid.MARGIN_TOP + n * grid.LINE_HEIGHT + grid.LINE_HEIGHT * 0.5 - 7;
        return (
          <Bulb
            key={`lsr-${n}`}
            color={COLORS[status]}
            top={top}
            pulse={status === "yellow"}
            rightPx={rightPx}
            leftPx={leftPx}
            label={`line ${n + 1} ${status}`}
          />
        );
      })}
    </>
  );
};

export default LineStatusRail;
