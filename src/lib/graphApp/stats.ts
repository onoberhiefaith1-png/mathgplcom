// Statistics and regression for Math Lab — pure.
export type Pt = [number, number];

/** Reads "1,2\n2,4" or "(1, 2) (2, 4)" or tab-separated pasted columns. */
export function parsePoints(src: string): Pt[] {
  const nums = (src.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  if (nums.length % 2) throw Error("Each point needs an x and a y.");
  const pts: Pt[] = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

export function summary(xs: number[]) {
  if (!xs.length) throw Error("Enter some data.");
  const n = xs.length, mean = xs.reduce((s, x) => s + x, 0) / n;
  const sorted = [...xs].sort((a, b) => a - b);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const sample = n > 1 ? xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : NaN;
  return { n, mean, median, sd: Math.sqrt(variance), sampleSd: Math.sqrt(sample), min: sorted[0], max: sorted[n - 1] };
}

/** Least-squares line y = a + bx, with r and R². */
export function regression(pts: Pt[]) {
  if (pts.length < 2) throw Error("Enter at least two points.");
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
  if (sxx === 0) throw Error("All x values are the same: no line can be fitted.");
  const slope = sxy / sxx, intercept = my - slope * mx;
  const r = syy === 0 ? 1 : sxy / Math.sqrt(sxx * syy);
  return { slope, intercept, r, r2: r * r, mx, my };
}
