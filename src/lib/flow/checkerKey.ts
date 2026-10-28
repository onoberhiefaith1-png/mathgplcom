// Detects a checkerboard "transparency preview" baked into video pixels and
// converts it into a real alpha matte. No AI.
//
// AI-made checkerboards are slightly warped and blurred, so we don't rely on
// an exact grid. Instead: learn the two checker colours (light + grey) from
// the picture border; a pixel is background when its colour lies on the line
// between those two colours AND it is connected to the border through other
// background pixels. White sparkles or eye highlights inside the Fairy are
// therefore never removed, and nothing is removed for being blue.

export interface CheckerModel {
  a: [number, number, number]; // light squares
  b: [number, number, number]; // grey squares
}

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Count light/dark alternations along a line; checkerboards alternate a lot. */
function alternations(vals: number[]) {
  const s = [...vals].sort((x, y) => x - y);
  const lo = s[Math.floor(s.length * 0.1)], hi = s[Math.floor(s.length * 0.9)];
  if (hi - lo < 15) return 0;
  const mid = (lo + hi) / 2;
  let n = 0;
  for (let i = 1; i < vals.length; i++) if ((vals[i - 1] > mid) !== (vals[i] > mid)) n++;
  return n / vals.length;
}

export function detectChecker(img: ImageData): CheckerModel | null {
  const { data: d, width: w, height: h } = img;
  const band = Math.max(4, Math.round(h * 0.03));
  const L = (x: number, y: number) => { const q = (y * w + x) * 4; return luma(d[q], d[q + 1], d[q + 2]); };
  const top = Array.from({ length: w }, (_, x) => L(x, 2));
  const left = Array.from({ length: h }, (_, y) => L(2, y));
  const alt = Math.max(alternations(top), alternations(left));
  // Collect border band pixels; 2-means on luma.
  const px: number[][] = [];
  let all = 0;
  for (let y = 0; y < band; y++) for (let x = 0; x < w; x += 2) for (const yy of [y, h - 1 - y]) {
    const q = (yy * w + x) * 4; all++; if (Math.max(d[q], d[q + 1], d[q + 2]) - Math.min(d[q], d[q + 1], d[q + 2]) < 30) px.push([d[q], d[q + 1], d[q + 2]]);
  }
  let c0 = 250, c1 = 200;
  for (let it = 0; it < 8; it++) {
    let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
    for (const p of px) { const l = luma(p[0], p[1], p[2]); if (Math.abs(l - c0) < Math.abs(l - c1)) { s0 += l; n0++; } else { s1 += l; n1++; } }
    if (n0) c0 = s0 / n0; if (n1) c1 = s1 / n1;
  }
  const acc = [[0, 0, 0, 0], [0, 0, 0, 0]];
  const core = Math.abs(c0 - c1) / 4;
  for (const p of px) {
    const l = luma(p[0], p[1], p[2]);
    const k = Math.abs(l - c0) < core ? 0 : Math.abs(l - c1) < core ? 1 : -1;
    if (k < 0) continue;
    acc[k][0] += p[0]; acc[k][1] += p[1]; acc[k][2] += p[2]; acc[k][3]++;
  }
  if (!acc[0][3] || !acc[1][3]) return null;
  const m: CheckerModel = {
    a: [acc[0][0] / acc[0][3], acc[0][1] / acc[0][3], acc[0][2] / acc[0][3]],
    b: [acc[1][0] / acc[1][3], acc[1][1] / acc[1][3], acc[1][2] / acc[1][3]],
  };
  let fit = 0;
  for (const p of px) if (segDist(m, p[0], p[1], p[2]).dist < 20) fit++;
  const fitFrac = fit / all;
  const gap = Math.abs(c0 - c1);
  console.info(`[checker] alt=${alt.toFixed(3)} light=${m.a.map(Math.round)} grey=${m.b.map(Math.round)} fit=${(fitFrac * 100).toFixed(0)}%`);
  return alt > 0.06 && gap > 15 && fitFrac > 0.5 ? m : null;
}

/** Distance from colour to the light–grey segment, and blend position t. */
function segDist(m: CheckerModel, r: number, g: number, b: number) {
  const ab0 = m.b[0] - m.a[0], ab1 = m.b[1] - m.a[1], ab2 = m.b[2] - m.a[2];
  const ap0 = r - m.a[0], ap1 = g - m.a[1], ap2 = b - m.a[2];
  const Lab = ab0 * ab0 + ab1 * ab1 + ab2 * ab2 || 1;
  // Allow a little beyond both ends (brighter white / darker grey from compression).
  const t = Math.max(-0.3, Math.min(1.3, (ap0 * ab0 + ap1 * ab1 + ap2 * ab2) / Lab));
  const dist = Math.max(Math.abs(ap0 - t * ab0), Math.abs(ap1 - t * ab1), Math.abs(ap2 - t * ab2));
  return { dist, t };
}

const LEVELS = { soft: [10, 34], normal: [16, 44], tight: [24, 58] } as const;

/** Writes alpha (0..255) and un-mixes checker colour out of soft pixels. */
export function keyChecker(m: CheckerModel, img: ImageData, alpha: Float32Array, strength: "soft" | "normal" | "tight", prev: Float32Array | null) {
  const { data: d, width: w, height: h } = img;
  const [lo, hi] = LEVELS[strength] ?? LEVELS.normal;
  const N = w * h;
  const raw = new Float32Array(N);
  const tt = new Float32Array(N);
  for (let p = 0, q = 0; p < N; p++, q += 4) {
    const { dist, t } = segDist(m, d[q], d[q + 1], d[q + 2]);
    tt[p] = t;
    raw[p] = dist <= lo ? 0 : dist >= hi ? 255 : ((dist - lo) / (hi - lo)) * 255;
  }
  // Background = connected to the border through near-background pixels.
  const bg = new Uint8Array(N);
  const stack: number[] = [];
  const seed = (p: number) => { if (!bg[p] && raw[p] < 200) { bg[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!, x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < N - w) seed(p + w);
  }
  for (let p = 0; p < N; p++) alpha[p] = bg[p] ? raw[p] : 255;
  removeSpecks(alpha, w, h, Math.max(30, Math.round(N * 0.0003)));
  if (prev) for (let p = 0; p < N; p++) if (Math.abs(prev[p] - alpha[p]) < 50) alpha[p] = alpha[p] * 0.7 + prev[p] * 0.3;
  // Un-mix soft edge pixels: F = (P - (1-a)B) / a. Solid pixels untouched.
  for (let p = 0, q = 0; p < N; p++, q += 4) {
    const a = alpha[p] / 255;
    if (a <= 0.02 || a >= 0.98) continue;
    const t = Math.max(0, Math.min(1, tt[p])), ia = 1 - a;
    for (let c = 0; c < 3; c++) {
      const B = m.a[c] + t * (m.b[c] - m.a[c]);
      d[q + c] = (d[q + c] - ia * B) / a;
    }
  }
}

/** Drop isolated opaque blobs smaller than minArea (compression noise). */
function removeSpecks(alpha: Float32Array, w: number, h: number, minArea: number) {
  const lab = new Int32Array(w * h);
  const stack: number[] = [];
  const comp: number[] = [];
  let id = 0;
  for (let s = 0; s < alpha.length; s++) {
    if (alpha[s] < 40 || lab[s]) continue;
    id++; comp.length = 0; stack.push(s); lab[s] = id;
    while (stack.length) {
      const p = stack.pop()!; comp.push(p);
      const x = p % w;
      if (x > 0 && !lab[p - 1] && alpha[p - 1] >= 40) { lab[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && !lab[p + 1] && alpha[p + 1] >= 40) { lab[p + 1] = id; stack.push(p + 1); }
      if (p >= w && !lab[p - w] && alpha[p - w] >= 40) { lab[p - w] = id; stack.push(p - w); }
      if (p < alpha.length - w && !lab[p + w] && alpha[p + w] >= 40) { lab[p + w] = id; stack.push(p + w); }
    }
    if (comp.length < minArea) for (const p of comp) alpha[p] = 0;
  }
}
