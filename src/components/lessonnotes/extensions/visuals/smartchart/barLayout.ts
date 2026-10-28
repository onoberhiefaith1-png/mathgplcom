// Bar/histogram layout arithmetic, extracted so the approved geometry rules can
// be pinned by tests (CHT-001):
//   • Distance from the Y-axis to the FIRST bar = one bar width.
//   • Bar chart: the gap between adjacent bars = one bar width.
//   • Histogram: adjacent bars touch (gap = 0).
// The renderer must not re-derive these numbers anywhere else.

export type BarWidthMode = "auto" | "thin" | "normal" | "wide";

export interface BarLayoutInput {
  /** Number of bars/classes to draw. */
  barCount: number;
  /** Width of one layout slot in svg units. */
  slotSvg: number;
  mode: BarWidthMode;
  isHistogram: boolean;
  /** Left padding of the plot (the Y-axis position). */
  padLeft: number;
}

export interface BarLayout {
  barWidth: number;
  gap: number;
  /** Distance from the Y-axis to the left edge of the first bar. */
  firstBarOffset: number;
  /** x of the left edge of bar i. */
  xForBar: (i: number) => number;
}

export const widthMultiplier = (mode: BarWidthMode): number =>
  mode === "thin" ? 0.5 : mode === "wide" ? 1.5 : 1;

export const barLayout = ({
  slotSvg,
  mode,
  isHistogram,
  padLeft,
}: BarLayoutInput): BarLayout => {
  const barWidth = Math.min(slotSvg, slotSvg * widthMultiplier(mode));
  const gap = isHistogram ? 0 : barWidth;
  return {
    barWidth,
    gap,
    firstBarOffset: barWidth,
    xForBar: (i: number) => padLeft + barWidth + i * (barWidth + gap),
  };
};
