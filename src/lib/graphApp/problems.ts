// Math Lab real-world problems. Answers are computed by the Lab's own engines (no AI),
// so the stored answer can never drift from the maths.
import { tangent, integrate, matrixOperation } from "./operations";
import { solveSystem, eigen, fmt } from "./linalg";

export type Topic = "Calculus" | "Matrices";
export interface Problem { id: string; topic: Topic; title: string; story: string; question: string; unit: string; answer: number; steps: string[]; plot?: string }

const build = (): Problem[] => {
  const v = tangent("y = 2x^2 + 3x", 4);
  const area = integrate("y = 0.5x + 2", 0, 6).value;
  const fence = 200 / 4; // square maximises area for fixed perimeter
  const [adult, child] = solveSystem([[1, 1], [12, 7]], [150, 1450]);
  const det = Number(matrixOperation([[3, 1], [1, 2]], [[1, 0], [0, 1]], "det"));
  const growth = Math.max(...eigen([[0, 2], [0.5, 0.5]]).real.map(e => e.value));
  return [
    { id: "speed", topic: "Calculus", title: "Speed of a car", story: "A car's distance in metres after t seconds is s = 2t² + 3t.", question: "What is its speed (m/s) at t = 4?", unit: "m/s", answer: v.slope,
      steps: ["Speed is the derivative of distance: ds/dt.", "ds/dt = 4t + 3", `At t = 4: 4(4) + 3 = ${fmt(v.slope)} m/s`], plot: "y = 2x^2 + 3x" },
    { id: "water", topic: "Calculus", title: "Water filling a tank", story: "Water flows into a tank at r(t) = 0.5t + 2 litres per minute.", question: "How many litres enter in the first 6 minutes?", unit: "litres", answer: area,
      steps: ["Total water = area under the rate graph: ∫₀⁶ (0.5t + 2) dt", "= [0.25t² + 2t] from 0 to 6", `= 0.25(36) + 12 = ${fmt(area)} litres`], plot: "y = 0.5x + 2" },
    { id: "fence", topic: "Calculus", title: "Farmer's fence", story: "A farmer has 200 m of fencing for a rectangular field.", question: "What side length (m) gives the largest area?", unit: "m", answer: fence,
      steps: ["Sides x and 100 − x, so A = x(100 − x) = 100x − x²", "dA/dx = 100 − 2x", "Set dA/dx = 0: x = 50", "d²A/dx² = −2 < 0, so it is a maximum: a 50 m × 50 m square."], plot: "y = 100x - x^2" },
    { id: "tickets", topic: "Matrices", title: "Cinema tickets", story: "150 tickets were sold. Adults pay £12, children £7. Takings were £1450.", question: "How many adult tickets were sold?", unit: "tickets", answer: adult,
      steps: ["a + c = 150 and 12a + 7c = 1450", "Matrix form: [1 1; 12 7][a; c] = [150; 1450]", "det = 1×7 − 1×12 = −5", `Solve: a = ${fmt(adult)}, c = ${fmt(child)}`] },
    { id: "image", topic: "Matrices", title: "Resizing an image", story: "A graphics program applies [3 1; 1 2] to a 1 cm² logo.", question: "What is the new area in cm²?", unit: "cm²", answer: Math.abs(det),
      steps: ["Areas scale by |det|.", "det = 3×2 − 1×1 = 5", `New area = 5 × 1 = ${fmt(Math.abs(det))} cm²`] },
    { id: "population", topic: "Matrices", title: "Rabbit population", story: "Each year adults have 2 young; half the young survive to adults and half the adults survive: L = [0 2; 0.5 0.5].", question: "By what factor does the population grow each year in the long run?", unit: "×", answer: growth,
      steps: ["Long-run growth = largest eigenvalue of L.", "λ² − 0.5λ − 1 = 0", `λ = (0.5 + √4.25) / 2 = ${fmt(growth)}`, "The population grows about 28% a year."] },
  ];
};
export const PROBLEMS: Problem[] = build();

/** Accept answers within 1% (or 0.01) — students may round. */
export const checkAnswer = (p: Problem, raw: string): boolean => {
  const n = Number(raw.replace(/[,£\s]/g, ""));
  return raw.trim() !== "" && Number.isFinite(n) && Math.abs(n - p.answer) <= Math.max(0.01, 0.01 * Math.abs(p.answer));
};
