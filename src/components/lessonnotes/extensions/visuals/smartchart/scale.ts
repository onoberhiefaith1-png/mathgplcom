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

/** Manual "cm : unit" scale. Returns an AxisScale plus derived pxPerUnit
 *  and numSteps so the plot can size itself in centimetre units. */
export interface ManualScaleResult extends AxisScale {
  numSteps: number;
  pxPerUnit: number;
  cmPerStep: number;
  unitPerStep: number;
}

const PX_PER_CM = 12; // internal SVG "cm"; visual scale is uniform to viewBox

export function resolveManualScale(y: {
  min: number; max: number; cmPerStep: number; unitPerStep: number;
}): ManualScaleResult {
  const min = Math.min(y.min, y.max);
  const max = Math.max(y.min, y.max);
  const unitPerStep = y.unitPerStep > 0 && Number.isFinite(y.unitPerStep) ? y.unitPerStep : 1;
  const cmPerStep = y.cmPerStep > 0 && Number.isFinite(y.cmPerStep) ? y.cmPerStep : 1;
  const numSteps = Math.max(1, Math.ceil((max - min) / unitPerStep));
  const ticks: number[] = [];
  for (let i = 0; i <= numSteps; i++) {
    ticks.push(Number((min + i * unitPerStep).toFixed(10)));
    if (ticks.length > 200) break;
  }
  const pxPerUnit = (cmPerStep * PX_PER_CM) / unitPerStep;
  return {
    min,
    max: min + numSteps * unitPerStep,
    step: unitPerStep,
    ticks,
    numSteps,
    pxPerUnit,
    cmPerStep,
    unitPerStep,
  };
}

/** Minor tick values between major ticks (exclusive of majors). */
export function minorTicks(scale: AxisScale, divisions: number): number[] {
  if (!Number.isFinite(divisions) || divisions <= 1) return [];
  const out: number[] = [];
  const sub = scale.step / divisions;
  for (let i = 0; i < scale.ticks.length - 1; i++) {
    const t0 = scale.ticks[i];
    for (let k = 1; k < divisions; k++) {
      out.push(Number((t0 + k * sub).toFixed(10)));
    }
    if (out.length > 800) break;
  }
  return out;
}

