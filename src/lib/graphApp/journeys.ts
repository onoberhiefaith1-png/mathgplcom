// Math Lab guided reference journeys — Stage 17. Pure and on-device.
// Every step's picture and answer are computed from the same seeded values,
// so "Change the numbers" rebuilds the whole journey consistently.
import { eigen } from "./linalg";
import { solidMeasures, type Solid } from "./solids";
import { binomialPmf } from "./probability";
import type { ConceptAction } from "./concepts";

export interface JourneyStep {
  question: string;
  hint: string;
  /** Text sent to the Math Lab input box, or a concept action. */
  input?: string;
  action?: ConceptAction;
  /** Numeric answer(s); the student types numbers separated by commas. */
  answer: number[];
  tolerance: number;
}

export interface Journey { id: string; title: string; build: (seed: number) => JourneyStep[] }

/** Deterministic small integer generator; seed 0 gives the reference values. */
export function seeded(seed: number) {
  let s = (seed * 2654435761) >>> 0;
  return (lo: number, hi: number) => { s = (s * 1664525 + 1013904223) >>> 0; return lo + (s % (hi - lo + 1)); };
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export const JOURNEYS: Journey[] = [
  {
    id: "lines",
    title: "Where two lines meet",
    build: (seed) => {
      const rnd = seeded(seed);
      const x = seed ? rnd(-4, 6) : 3, y = seed ? rnd(-4, 6) : 3;
      const m = seed ? rnd(1, 3) : 1;
      const c1 = y - m * x, s = x + y;
      return [
        { question: `Line 1: y = ${m}x ${c1 >= 0 ? "+" : "-"} ${Math.abs(c1)}. What is y when x = 0?`, hint: "Read the y-intercept: the number added on.", input: `y = ${m}x ${c1 >= 0 ? "+" : "-"} ${Math.abs(c1)}`, answer: [c1], tolerance: 1e-6 },
        { question: `Add line 2: x + y = ${s}. Where do they cross? Type x, y.`, hint: "Substitute line 1 into line 2 and solve for x.", input: `y = ${m}x ${c1 >= 0 ? "+" : "-"} ${Math.abs(c1)}\nx + y = ${s}`, answer: [x, y], tolerance: 1e-6 },
      ];
    },
  },
  {
    id: "parabola",
    title: "Roots and vertex of a parabola",
    build: (seed) => {
      const rnd = seeded(seed);
      const p = seed ? rnd(-5, 0) : 1, q = seed ? rnd(1, 6) : 5;
      const [a, b] = [Math.min(p, q), Math.max(p, q)];
      const src = `y = (x - ${a})(x - ${b})`.replace(/- -/g, "+ ");
      const h = (a + b) / 2, k = (h - a) * (h - b);
      return [
        { question: `${src}. Where does it cross the x-axis? Type both roots, smaller first.`, hint: "A product is zero when one bracket is zero.", input: src, answer: [a, b], tolerance: 1e-6 },
        { question: "What is the vertex? Type h, k.", hint: "The vertex is halfway between the roots.", input: src, answer: [h, k], tolerance: 1e-6 },
      ];
    },
  },
  {
    id: "cube",
    title: "Cube to cuboid",
    build: (seed) => {
      const rnd = seeded(seed);
      const s = seed ? rnd(2, 9) : 5, extra = seed ? rnd(1, 4) : 2;
      const cube: Solid = { kind: "cube", unit: "cm", dimensions: [s], source: `cube with side ${s} cm` };
      const cuboid: Solid = { kind: "cuboid", unit: "cm", dimensions: [s, s, s + extra], source: `cuboid ${s} cm by ${s} cm by ${s + extra} cm` };
      const m = solidMeasures(cube), n = solidMeasures(cuboid);
      return [
        { question: `A cube with side ${s} cm. What is its volume in cm³?`, hint: "V = side × side × side.", input: cube.source, answer: [m[0].value], tolerance: 1e-6 },
        { question: "What is its surface area in cm²?", hint: "Six equal square faces.", input: cube.source, answer: [m[1].value], tolerance: 1e-6 },
        { question: "How long is the space diagonal in cm? (3 decimals)", hint: "d = √(3) × side.", input: cube.source, answer: [r6(m[2].value)], tolerance: 1e-3 },
        { question: `Make the height ${s + extra} cm. New volume in cm³?`, hint: "V = l × w × h.", input: cuboid.source, answer: [n[0].value], tolerance: 1e-6 },
      ];
    },
  },
  {
    id: "riemann",
    title: "Area under a curve",
    build: (seed) => {
      const b = seed ? seeded(seed)(2, 6) : 3;
      const sum = (n: number) => { let t = 0; const dx = b / n; for (let i = 1; i <= n; i++) t += (i * dx) ** 2 * dx; return t; };
      return [
        { question: `Right-hand rectangles on y = x² from 0 to ${b}, 4 rectangles. Their total area? (3 decimals)`, hint: `Width ${b}/4; add width × height at each right edge.`, input: "y = x^2", answer: [r6(sum(4))], tolerance: 1e-3 },
        { question: "With 100 rectangles? (3 decimals)", hint: "More, thinner rectangles waste less area.", input: "y = x^2", answer: [r6(sum(100))], tolerance: 1e-3 },
        { question: `The exact area is ∫₀^${b} x² dx. What is it? (3 decimals)`, hint: "x³/3 evaluated at the bounds.", input: "y = x^2", answer: [r6(b ** 3 / 3)], tolerance: 1e-3 },
      ];
    },
  },
  {
    id: "eigen",
    title: "Directions a matrix keeps",
    build: (seed) => {
      const rnd = seeded(seed);
      const d = seed ? rnd(2, 5) : 2, o = seed ? rnd(1, 3) : 1;
      const A = [[d, o], [o, d]];
      const vals = eigen(A).real.map(e => e.value).sort((x, y) => y - x);
      return [
        { question: `A = [${d} ${o}; ${o} ${d}]. What are its eigenvalues? Larger first.`, hint: "Solve det(A − λI) = 0.", action: { panel: "matrices", matrix: A }, answer: vals, tolerance: 1e-6 },
        { question: "A × (1, 1) = λ(1, 1). Which λ? ", hint: "Multiply the matrix by (1, 1).", action: { panel: "matrices", matrix: A }, answer: [d + o], tolerance: 1e-6 },
      ];
    },
  },
  {
    id: "probability",
    title: "Binomial to normal",
    build: (seed) => {
      const n = seed ? seeded(seed)(6, 14) : 10;
      const k = Math.floor(n / 2);
      const plots: string[] = [];
      for (let i = 0; i <= n; i++) plots.push(`(${i}, ${binomialPmf(n, 0.5, i)})`);
      const sd = Math.sqrt(n * 0.25);
      return [
        { question: `${n} fair coin tosses. P(exactly ${k} heads)? (4 decimals)`, hint: "C(n,k) × 0.5ⁿ.", action: { plots, panel: "probability" }, answer: [binomialPmf(n, 0.5, k)], tolerance: 1e-4 },
        { question: "Mean number of heads?", hint: "Mean = n × p.", action: { plots }, answer: [n * 0.5], tolerance: 1e-6 },
        { question: "Standard deviation? (3 decimals)", hint: "√(n p (1 − p)). The normal curve with this mean and spread fits the bars.", action: { plots: [...plots, `y = exp(-((x - ${n / 2})^2)/(2*${sd * sd}))/${(sd * Math.sqrt(2 * Math.PI)).toFixed(6)}`] }, answer: [r6(sd)], tolerance: 1e-3 },
      ];
    },
  },
];

/** Compare a typed answer ("3, 3" or "(3,3)") with the computed values. */
export function checkAnswer(step: JourneyStep, typed: string): boolean {
  const nums = (typed.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length !== step.answer.length) return false;
  return nums.every((v, i) => Math.abs(v - step.answer[i]) <= step.tolerance + 1e-9);
}
