// "Nice" auto-scale helpers used by every chart kind that has a numeric
// axis. `niceDomain` rounds the data range outward to a friendly step
// (1/2/5 × 10ⁿ) so tick labels are always readable. `ticks` walks the
// domain in step increments.

export interface AxisScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

function niceStep(range: number, targetTicks = 5): number {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const rough = range / targetTicks;
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const norm = rough / base;
  let mult = 1;
  if (norm >= 5) mult = 5;
  else if (norm >= 2) mult = 2;
  else mult = 1;
  return mult * base;
}

export function niceDomain(rawMin: number, rawMax: number, includeZero = true): AxisScale {
  let lo = Math.min(rawMin, rawMax);
  let hi = Math.max(rawMin, rawMax);
  if (includeZero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (lo === hi) { hi = lo + 1; }
  const step = niceStep(hi - lo, 5);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step * 0.5; t += step) {
    // avoid float drift
    ticks.push(Number(t.toFixed(10)));
    if (ticks.length > 40) break;
  }
  return { min, max, step, ticks };
}

export function manualScale(min: number, max: number, step: number): AxisScale {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const s = step > 0 && Number.isFinite(step) ? step : Math.max(1e-6, (hi - lo) / 5);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + s * 0.5; t += s) {
    ticks.push(Number(t.toFixed(10)));
    if (ticks.length > 60) break;
  }
  return { min: lo, max: hi, step: s, ticks };
}

/** Auto or manual — resolves both into a concrete AxisScale. */
export function resolveYScale(
  values: number[],
  yAuto: boolean,
  yMin: number | null,
  yMax: number | null,
  yStep: number | null = null,
): AxisScale {
  if (yAuto) {
    if (values.length === 0) return niceDomain(0, 10, true);
    const dataMin = Math.min(...values, 0);
    const dataMax = Math.max(...values, 0);
    return niceDomain(dataMin, dataMax, true);
  }
  const dataMin = values.length ? Math.min(...values, 0) : 0;
  const dataMax = values.length ? Math.max(...values, 0) : 10;
  const lo = yMin == null ? dataMin : yMin;
  const hi = yMax == null ? dataMax : yMax;
  if (yStep != null && yStep > 0) return manualScale(lo, hi, yStep);
  return niceDomain(lo, hi, false);
}
