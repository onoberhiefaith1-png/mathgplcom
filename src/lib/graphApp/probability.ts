// Probability distributions for Math Lab — pure.
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) r = r * (n - i + 1) / i;
  return r;
}
export function binomialPmf(n: number, p: number, k: number): number {
  if (!Number.isInteger(n) || n < 0 || p < 0 || p > 1) throw Error("Use whole n ≥ 0 and 0 ≤ p ≤ 1.");
  return choose(n, k) * p ** k * (1 - p) ** (n - k);
}
export function poissonPmf(lambda: number, k: number): number {
  if (!(lambda > 0)) throw Error("λ must be positive.");
  let logF = 0;
  for (let i = 2; i <= k; i++) logF += Math.log(i);
  return Math.exp(k * Math.log(lambda) - lambda - logF);
}
export function normalPdf(x: number, mu: number, sigma: number): number {
  if (!(sigma > 0)) throw Error("σ must be positive.");
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}
/** erf with Abramowitz–Stegun 7.1.26 refined by series for small |x| (error < 1e-9). */
function erf(x: number): number {
  const s = Math.sign(x), ax = Math.abs(x);
  if (ax < 3) {
    let sum = 0, term = ax;
    for (let n = 0; n < 80; n++) { sum += term / (2 * n + 1); term *= -ax * ax / (n + 1); }
    return s * 2 / Math.sqrt(Math.PI) * sum;
  }
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return s * y;
}
export const normalCdf = (x: number, mu: number, sigma: number) => 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
export const normalBetween = (a: number, b: number, mu: number, sigma: number) => normalCdf(Math.max(a, b), mu, sigma) - normalCdf(Math.min(a, b), mu, sigma);

export function moments(kind: "binomial" | "poisson", a: number, b = 0) {
  return kind === "binomial" ? { mean: a * b, variance: a * b * (1 - b) } : { mean: a, variance: a };
}
