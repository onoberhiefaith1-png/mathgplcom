// Math Lab concept entry — Stage 15. An on-device registry of concepts the
// student can type ("eigenvalues", "binomial distribution", "Riemann sums"…).
// Each concept names the values it needs, then builds the demonstration from
// the engines already in Math Lab. No AI guessing, no network.

export interface ConceptInput {
  key: string;
  label: string;
  hint: string;
  def: string;
}

/** What a concept tells the page to do once its values are known. */
export interface ConceptAction {
  plots?: string[];
  panel?: string;
  matrix?: number[][];
  nd?: number;
  note?: string;
}

export interface Concept {
  id: string;
  title: string;
  match: RegExp;
  question: string;
  inputs: ConceptInput[];
  run: (values: Record<string, string>) => ConceptAction;
}

const num = (s: string | undefined, d: number) => {
  const v = Number(s);
  return Number.isFinite(v) ? v : d;
};

/** Fourier partial sum of the square wave: sin x + sin(3x)/3 + sin(5x)/5 + … */
export function fourierSquareWave(terms: number): string {
  const n = Math.max(1, Math.min(25, Math.round(terms)));
  const parts: string[] = [];
  for (let k = 0; k < n; k++) {
    const m = 2 * k + 1;
    parts.push(m === 1 ? "sin(x)" : `sin(${m}x)/${m}`);
  }
  return `y = ${parts.join(" + ")}`;
}

export const CONCEPTS: Concept[] = [
  {
    id: "eigenvalues",
    title: "Eigenvalues & eigenvectors",
    match: /eigen/i,
    question: "Which directions does a matrix leave unchanged?",
    inputs: [
      { key: "a", label: "Matrix A", hint: "[2 1; 1 2]", def: "[2 1; 1 2]" },
    ],
    run: (v) => {
      const m = v.a?.trim() || "[2 1; 1 2]";
      return { panel: "matrices", matrix: parseConceptMatrix(m) ?? [[2, 1], [1, 2]], note: "Matrix loaded — open the eigen tool in the Matrices panel." };
    },
  },
  {
    id: "binomial",
    title: "Binomial distribution",
    match: /binomial/i,
    question: "How are the probabilities of k successes spread out?",
    inputs: [
      { key: "n", label: "Trials n", hint: "10", def: "10" },
      { key: "p", label: "Success probability p", hint: "0.5", def: "0.5" },
    ],
    run: (v) => {
      const n = Math.max(1, Math.min(60, Math.round(num(v.n, 10))));
      const p = Math.min(1, Math.max(0, num(v.p, 0.5)));
      const plots: string[] = [];
      for (let k = 0; k <= n; k++) plots.push(`(${k}, ${binomialPmf(n, p, k)})`);
      return { panel: "probability", plots, note: `Binomial(${n}, ${p}) plotted as points — see the Probability panel for exact values.` };
    },
  },
  {
    id: "riemann",
    title: "Riemann sums → definite integral",
    match: /riemann|area under/i,
    question: "Why do rectangles converge to the exact area?",
    inputs: [
      { key: "f", label: "Function", hint: "x^2", def: "x^2" },
      { key: "a", label: "Lower bound a", hint: "0", def: "0" },
      { key: "b", label: "Upper bound b", hint: "3", def: "3" },
    ],
    run: (v) => ({
      panel: "calculus",
      plots: [`y = ${v.f?.trim() || "x^2"}`],
      note: "Curve plotted — use the Area / Riemann tool in the Calculus panel and raise the rectangle count.",
    }),
  },
  {
    id: "fourier",
    title: "Fourier series",
    match: /fourier/i,
    question: "How do plain sine waves add up to a square wave?",
    inputs: [{ key: "n", label: "Number of terms", hint: "5", def: "5" }],
    run: (v) => {
      const n = num(v.n, 5);
      const plots = [fourierSquareWave(1), fourierSquareWave(Math.min(n, 3)), fourierSquareWave(n)];
      return { plots, note: `Square wave built from 1, ${Math.min(n, 3)} and ${n} sine terms — watch the wiggles shrink near the jumps.` };
    },
  },
  {
    id: "4d",
    title: "4D geometry",
    match: /4d|hypercube|tesseract|higher dimension/i,
    question: "What does a cube look like in four dimensions?",
    inputs: [{ key: "n", label: "Dimension (4–6)", hint: "4", def: "4" }],
    run: (v) => ({ nd: Math.max(4, Math.min(6, Math.round(num(v.n, 4)))), note: "Rotating the extra dimension — drag the ND angle slider in View Controls." }),
  },
  {
    id: "taylor",
    title: "Taylor series",
    match: /taylor|maclaurin/i,
    question: "How well does a polynomial imitate a curve near a point?",
    inputs: [
      { key: "f", label: "Function", hint: "sin(x)", def: "sin(x)" },
      { key: "a", label: "Around x =", hint: "0", def: "0" },
    ],
    run: (v) => ({
      panel: "analysis",
      plots: [`y = ${v.f?.trim() || "sin(x)"}`],
      note: "Curve plotted — open the Taylor tab in the Analysis panel and raise the degree.",
    }),
  },
  {
    id: "normal",
    title: "Normal distribution",
    match: /normal distribution|bell curve|gaussian/i,
    question: "Why do measurements cluster around the mean?",
    inputs: [
      { key: "mu", label: "Mean μ", hint: "0", def: "0" },
      { key: "sigma", label: "Spread σ", hint: "1", def: "1" },
    ],
    run: (v) => {
      const mu = num(v.mu, 0), s = Math.max(0.05, num(v.sigma, 1));
      return {
        panel: "probability",
        plots: [`y = exp(-((x - ${mu})^2)/(2*${s * s}))/${(s * Math.sqrt(2 * Math.PI)).toFixed(6)}`],
        note: `Normal curve with mean ${mu} and spread ${s} — the Probability panel computes areas under it.`,
      };
    },
  },
];

function parseConceptMatrix(src: string): number[][] | null {
  const s = src.trim();
  if (!/^\[.*\]$/.test(s)) return null;
  const rows = s.replace(/^\[\s*\[?|\]?\s*\]$/g, "").split(/\]\s*,\s*\[|;/).map(r =>
    r.trim().split(/[\s,]+/).filter(Boolean).map(Number));
  const n = rows.length;
  if (![2, 3].includes(n) || rows.some(r => r.length !== n || r.some(v => !Number.isFinite(v)))) return null;
  return rows;
}

function binomialPmf(n: number, p: number, k: number): number {
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

/** Find the concept a phrase names, or null. */
export function matchConcept(input: string): Concept | null {
  const s = input.trim();
  if (!/^[a-z0-9\s'-]+$/i.test(s)) return null;
  return CONCEPTS.find(c => c.match.test(s)) ?? null;
}
