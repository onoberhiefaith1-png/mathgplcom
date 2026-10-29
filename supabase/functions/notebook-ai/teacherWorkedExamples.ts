import { teachingContextCandidates, teachingSubjectFamily } from "./teacherLessonContext.ts";

// Reviewed few-shot references, not live-model evaluation results.
// Select only relevant samples, so a Maths lesson does not pay for every topic.
export interface TeacherWorkedExample {
  id: string;
  topic: string;
  question: string;
  working: string[];
  checks: string[];
}
const matrix = (values: string[]) => `[[tool:structure kind="matrix" rows="3" cols="3" bracket="square" slots="${values.join(" | ")}"]]`;
const A = [[1,2,0],[2,0,1],[3,1,2]], B = [[1,0,2],[0,1,0],[2,0,1]];
export const TEACHER_WORKED_EXAMPLES: TeacherWorkedExample[] = [
  {
    id: "matrix-product", topic: "matrix",
    question: `Find AB.\nA =\n${matrix(A.flat().map(String))}\nB =\n${matrix(B.flat().map(String))}`,
    working: [
      "Multiply each row of A by each column of B.", "AB =",
      matrix(A.flatMap(row => B[0].map((_,j) => row.map((value,k) => `${value}×${B[k][j]}`).join(" + ")))),
      "=", matrix(["1","2","2","4","0","5","7","1","8"]),
    ],
    checks: ["All nine dot products occupy their correct cells.", "No repetitive c11/c12 narration; no lost zero terms; final shape 3 by 3."],
  },
  {
    id: "trig-all-solutions", topic: "trigonometry",
    question: "Solve sin(2θ) = sin θ for 0° ≤ θ < 360°.",
    working: [
      "Use sin(2θ) = 2 sin θ cos θ.",
      "2 sin θ cos θ − sin θ = 0", "sin θ(2 cos θ − 1) = 0",
      "Either sin θ = 0", "or cos θ = ½.",
      "sin θ is zero at 0° and 180° in this interval.",
      "cos θ is one half at 60° and 300° in this interval.",
      "θ ∈ {0°, 60°, 180°, 300°}",
    ],
    checks: ["Keep degree units and both factors.", "Do not divide by sin θ and lose solutions.", "360° is excluded."],
  },
  {
    id: "calculus-chain-rule", topic: "differentiation",
    question: "Differentiate y = (3x² + 1)⁴ with respect to x.",
    working: [
      "Use the chain rule: differentiate the outer power, then multiply by the inner derivative.",
      "u = 3x² + 1", String.raw`\frac{du}{dx} = 6x`,
      String.raw`\frac{dy}{du} = 4u³`,
      String.raw`\frac{dy}{dx} = 4(3x² + 1)³(6x)`,
      String.raw`\frac{dy}{dx} = 24x(3x² + 1)³`,
    ], checks: ["Inner derivative is visible.", "No missing factor 6x; preserve derivative fractions."],
  },
  {
    id: "calculus-bounds", topic: "integration",
    question: String.raw`Evaluate \int_{0}^{1} 3x² dx.`,
    working: [
      "Use the power rule to find the antiderivative, then evaluate upper minus lower.",
      String.raw`\int 3x² dx = x³ + C`,
      String.raw`\int_{0}^{1} 3x² dx = [x³]_{0}^{1}`,
      String.raw`\int_{0}^{1} 3x² dx = 1³ − 0³`,
      String.raw`\int_{0}^{1} 3x² dx = 1`,
    ], checks: ["Preserve integral limits and differential.", "+ C belongs to the indefinite antiderivative, not the definite value."],
  },
  {
    id: "analysis-sequence", topic: "analysis",
    question: "Prove that the sequence 1/n converges to 0.",
    working: [
      "Let ε > 0 be arbitrary.", "Choose an integer N > 1/ε.",
      "Take any integer n ≥ N.", "|1/n − 0| = 1/n ≤ 1/N < ε",
      "Thus 1/n → 0 by the definition of sequence convergence.",
    ], checks: ["N depends on ε, not on n.", "The bound holds for every n ≥ N; numerical examples alone do not prove convergence."],
  },
  {
    id: "analysis-continuity", topic: "analysis",
    question: "Prove from the definition that f(x) = 3x + 2 is continuous at every real a.",
    working: [
      "Fix any real a and let ε > 0.", "Choose δ = ε/3.",
      "Suppose |x − a| < δ.", "|f(x) − f(a)| = 3|x − a| < 3δ",
      "3δ = ε", "Therefore |f(x) − f(a)| < ε.",
      "Hence f is continuous at a. Since a was arbitrary, f is continuous on ℝ.",
    ], checks: ["δ is positive and chosen before x.", "State that a is arbitrary to conclude continuity everywhere."],
  },
  {
    id: "finite-summation", topic: "series",
    question: String.raw`Evaluate S_n = \sum_{k=1}^{n} (2k − 1) for positive integers n.`,
    working: [
      "Use linearity of finite sums and the formula for the first n positive integers.",
      String.raw`S_n = 2\sum_{k=1}^{n} k − \sum_{k=1}^{n} 1`,
      String.raw`S_n = 2\frac{n(n+1)}{2} − n`,
      "S_n = n(n+1) − n", "S_n = n²",
    ], checks: ["Keep both sigma bounds and the index variable.", "The answer is a formula valid for every positive integer n, not a few sampled sums."],
  },
  {
    id: "infinite-geometric-series", topic: "series",
    question: String.raw`Evaluate \sum_{k=0}^{\infty} \left(\frac{1}{3}\right)^k.`,
    working: [
      "The ratio r = ⅓ has absolute value less than 1, so the geometric series converges.",
      String.raw`S_N = \sum_{k=0}^{N} \left(\frac{1}{3}\right)^k`,
      String.raw`S_N = \frac{1-(\frac{1}{3})^{N+1}}{1-\frac{1}{3}}`,
      String.raw`\lim_{N\to\infty} (\frac{1}{3})^{N+1} = 0`,
      String.raw`\lim_{N\to\infty} S_N = \frac{1}{1-\frac{1}{3}}`,
      String.raw`\sum_{k=0}^{\infty} \left(\frac{1}{3}\right)^k = \frac{3}{2}`,
    ], checks: ["Distinguish the finite partial sum from the infinite sum.", "State and check |r| < 1 before using the infinite-sum formula."],
  },
  {
    id: "analysis-uniform-counterexample", topic: "analysis",
    question: "Does f_n(x) = xⁿ converge uniformly on [0,1]? Justify your answer.",
    working: [
      "For each fixed x with 0 ≤ x < 1, xⁿ → 0.", "For x = 1, f_n(1) = 1 for every n.",
      String.raw`f(x) = \begin{cases}0 & 0 ≤ x < 1 \\ 1 & x = 1\end{cases}`,
      "Every f_n is continuous on [0,1]. The pointwise limit f is discontinuous at 1.",
      "A uniform limit of continuous functions on the same domain must be continuous.",
      "Therefore f_n does not converge uniformly on [0,1].",
    ], checks: ["The continuity hypotheses are stated before using the uniform-limit theorem.", "Pointwise convergence alone does not prove uniform convergence."],
  },
  {
    id: "number-fractions", topic: "number",
    question: String.raw`Add \frac{2}{3} and \frac{1}{4}. Give the answer in simplest form.`,
    working: [
      "Use 12 as the common denominator.",
      String.raw`\frac{2}{3} = \frac{8}{12}`,
      String.raw`\frac{1}{4} = \frac{3}{12}`,
      String.raw`\frac{2}{3} + \frac{1}{4} = \frac{8+3}{12}`,
      String.raw`\frac{2}{3} + \frac{1}{4} = \frac{11}{12}`,
      "The numerator and denominator have no common factor greater than 1.",
    ], checks: ["The common denominator and equivalent fractions are visible.", "Use genuine fractions, not slash fragments or arithmetic commands."],
  },
  {
    id: "algebra-factorisation", topic: "algebra",
    question: "Solve x² + 5x + 6 = 0 by factorisation.",
    working: [
      "Two numbers with product 6 and sum 5 are 2 and 3.",
      "(x + 2)(x + 3) = 0",
      "By the zero-product rule, at least one factor is zero.",
      "x + 2 = 0", "x = −2",
      "or x + 3 = 0", "x = −3",
      "Thus the solutions are −2 and −3.",
    ], checks: ["The factorisation and both roots are shown.", "Explain the decisive rule once, rather than repeat solve instructions."],
  },
  {
    id: "statistics-frequency-mean", topic: "statistics",
    question: "Scores 2, 4 and 6 have frequencies 1, 4 and 1 respectively. Find the mean score.",
    working: [
      "Use a frequency table to obtain the total score and the number of scores.",
      '[[tool:smartTable headers="x | f | fx" rows="2 | 1 | 2 ; 4 | 4 | 16 ; 6 | 1 | 6"]]',
      String.raw`\sum f = 6`, String.raw`\sum fx = 24`,
      String.raw`\bar{x} = \frac{\sum fx}{\sum f}`,
      String.raw`\bar{x} = \frac{24}{6}`,
      String.raw`\bar{x} = 4`,
      "The mean score is 4.",
    ], checks: ["One native Smart Table keeps x, f and fx aligned.", "Mean notation is structured and the final value is interpreted.", "This is an exact ungrouped mean, not a midpoint estimate."],
  },
  {
    id: "probability-without-replacement", topic: "probability",
    question: "A bag contains 3 red and 2 blue counters. Two counters are drawn without replacement. Find the probability that both are red.",
    working: [
      "Let R₁ and R₂ denote red counters on the first and second draws.",
      String.raw`P(R₁) = \frac{3}{5}`,
      "After a red counter is removed, 2 red counters remain among 4 counters.",
      String.raw`P(R₂ \mid R₁) = \frac{2}{4}`,
      String.raw`P(R₁ \cap R₂) = \frac{3}{5} × \frac{2}{4}`,
      String.raw`P(R₁ \cap R₂) = \frac{3}{10}`,
      "The draws are dependent; the second probability uses the reduced contents.",
    ], checks: ["The conditional denominator changes after removal.", "The final probability refers to the stated event, not an unrelated expected value."],
  },
  {
    id: "geometry-circle-angle", topic: "geometry",
    question: "A, B and C lie on a circle with centre O. C lies on the major arc AB, and ∠ACB = 48°. Find the smaller central angle ∠AOB subtended by the minor arc AB.",
    working: [
      "The central angle and ∠ACB stand on the same minor arc AB.",
      "The angle at the centre is twice the angle at the circumference on the same arc.",
      "∠AOB = 2 × 48°", "∠AOB = 96°",
      "The required central angle is 96°.",
    ], checks: ["The arc and vertex labels are explicit.", "Place a supported labelled diagram with the question when a figure is requested; do not infer facts from its appearance.", "A reason accompanies the angle calculation."],
  },
  {
    id: "abstract-homomorphism", topic: "abstract-algebra",
    question: "Let φ: (ℤ,+) → (ℤ/6ℤ,+) send each integer n to its residue class [n]. Prove that φ is a homomorphism and find its kernel.",
    working: [
      "The domain uses integer addition and the codomain uses addition of residue classes modulo 6.",
      "For arbitrary integers m and n, the definition of φ gives:",
      "φ(m + n) = [m + n]",
      "Addition of residue classes is defined by [m] + [n] = [m + n].",
      "Therefore φ(m + n) = φ(m) + φ(n).",
      "Thus φ preserves addition and is a group homomorphism.",
      "An integer n belongs to the kernel exactly when [n] is the zero residue class, or equivalently when 6 divides n.",
      "ker φ = {6k : k ∈ ℤ}", "ker φ = 6ℤ",
    ], checks: ["Define the operations and distinguish an integer from its residue class.", "Use arbitrary m and n rather than sampled integers as proof.", "The kernel is a subset of the domain; no unnecessary list of all group axioms."],
  },
  {
    id: "engineering-rc-model", topic: "engineering",
    question: "An ideal series RC circuit has R = 2 kΩ and C = 100 μF. A constant 10 V source is connected at t = 0 with an initially uncharged capacitor. Find the capacitor voltage v(t) for t ≥ 0.",
    working: [
      "Use the ideal RC charging model, with capacitor voltage measured in the charging direction.",
      "R = 2000 Ω", "C = 100 × 10⁻⁶ F",
      "τ = RC", "τ = 2000 × 100 × 10⁻⁶ s", "τ = 0.2 s",
      String.raw`RC\frac{dv}{dt} + v = 10`, "v(0) = 0",
      "The constant-source first-order equation has the general charging solution:",
      String.raw`v(t) = 10 + Ke^{-t/τ}`,
      "0 = 10 + K", "K = −10",
      String.raw`v(t) = 10(1 − e^{-t/(0.2\,s)})\,V`,
      "At t = 0 the voltage is 0 V; as t increases it approaches 10 V. The exponent is dimensionless and τ has units of time.",
    ], checks: ["Governing relation, initial condition, unit conversion and selected constant are visible.", "State the ideal model; this is a teaching calculation rather than a certified component design."],
  },
  {
    id: "engineering-beam-equilibrium", topic: "engineering",
    question: "A weightless horizontal beam AB is 3 m long, with simple vertical supports at A and B. A downward 600 N point load acts 1 m from A. Find the vertical reactions at A and B.",
    working: [
      "Take upward forces and anticlockwise moments as positive. Use the stated ideal weightless beam model.",
      "Taking moments about A removes the unknown reaction at A.",
      "(3 m)R_B − (600 N)(1 m) = 0", "R_B = 200 N",
      "Vertical force equilibrium gives:", "R_A + R_B − 600 N = 0",
      "R_A + 200 N − 600 N = 0", "R_A = 400 N",
      "The reactions are 400 N upward at A and 200 N upward at B; their total balances the 600 N load.",
    ], checks: ["Use the given lever arms and state the moment convention.", "Keep forces and moments dimensionally distinct and conclude with directions."],
  },
];

function relevantTopics(body: Record<string, any>): Set<string> {
  for (const context of teachingContextCandidates(body)) {
    const topics = detectTopics(context.toLowerCase());
    if (topics.size) return topics;
  }
  return new Set<string>();
}

function detectTopics(text: string): Set<string> {
  const topics = new Set<string>();
  if (/\b(?:fraction|fractions|arithmetic|number work|common denominator)\b/.test(text)) topics.add("number");
  if (/quadratic|factoris|factoriz|linear equation|simultaneous equation|elementary algebra/.test(text)) topics.add("algebra");
  if (/statistic|frequency|frequencies|\bmean\b|variance|standard deviation|median|histogram/.test(text)) topics.add("statistics");
  if (/probability|conditional|without replacement|binomial|random variable/.test(text)) topics.add("probability");
  // "Geometric series" has its own sample; it is not circle geometry.
  if (/\bgeometry\b|circle theorem|angle at the centre|angle at the center|\barc\b|\btriangle\b|mensuration/.test(text)) topics.add("geometry");
  if (/abstract (?:algebra|mathematics|maths)|group theory|homomorphism|isomorphism|\b(?:groups|rings|fields|quotient)\b/.test(text)) topics.add("abstract-algebra");
  if (/engineering|\b(?:rc circuit|capacitor|beam|statics|equilibrium|kirchhoff)\b/.test(text)) topics.add("engineering");
  if (/matri(?:x|ces|cs)|linear algebra|determinant/.test(text)) topics.add("matrix");
  if (/trigonom|\bsin\b|\bcos\b|\btan\b/.test(text)) topics.add("trigonometry");
  if (/differentiat|derivative|chain rule|product rule|quotient rule/.test(text)) topics.add("differentiation");
  if (/integrat|antiderivative|\bint\b|∫/.test(text)) topics.add("integration");
  if (/real analysis|epsilon|ε|convergen|continuity|continuous/.test(text)) topics.add("analysis");
  if (/\bseries\b|summation|\\sum\b|∑|sum of (?:the )?first/.test(text)) topics.add("series");
  if (/calculus/.test(text) && !topics.has("differentiation") && !topics.has("integration")) {
    topics.add("differentiation"); topics.add("integration");
  }
  return topics;
}

export function teacherWorkedExamplesForRequest(body: Record<string, any>): string {
  const family = teachingSubjectFamily(body);
  if (family === "other") return "";
  if (body.mode === "copilot" && !["blueprint", "revise", "reviseItem", "analyse"].includes(body.stage)) return "";
  const topics = relevantTopics(body);
  let samples = TEACHER_WORKED_EXAMPLES.filter(sample => topics.has(sample.topic));
  if (family === "engineering") samples = samples.filter(sample => sample.topic === "engineering");
  const focus = teachingContextCandidates(body).find(text => detectTopics(text.toLowerCase()).size > 0) ?? "";
  if (topics.has("engineering")) {
    const preferred = /beam|statics|equilibrium|moment/i.test(focus) ? "engineering-beam-equilibrium" : "engineering-rc-model";
    samples = samples.filter(sample => sample.topic !== "engineering" || sample.id === preferred);
  }
  if (topics.has("series")) {
    const text = focus;
    const preferred = /infinite|geometric|∞|infty/i.test(text) ? "infinite-geometric-series" : "finite-summation";
    samples = samples.filter(sample => sample.topic !== "series" || sample.id === preferred);
  }
  if (topics.has("analysis")) {
    const text = focus;
    const preferred = /uniform/i.test(text) ? "analysis-uniform-counterexample" : /continu/i.test(text) ? "analysis-continuity" : "analysis-sequence";
    samples = samples.filter(sample => sample.topic !== "analysis" || sample.id === preferred);
  }
  samples = samples.slice(0, 2);
  if (!samples.length) return "";
  return [
    "REVIEWED TEACHER-STYLE REFERENCES — learn the arrangement, not the numbers.",
    "These are reference questions only. Solve the actual teacher question, retain its exact inputs and requested counts, and match its curriculum level.",
    "Follow the current mode and response schema: when planning a blueprint or writing a question, do not include the worked solution yet. When editing a fragment, respect that target rather than replacing the whole lesson.",
    ...samples.map(sample => [
      `Reference: ${sample.id}`, sample.question, ...sample.working,
      `Review checks: ${sample.checks.join(" ")}`,
    ].join("\n")),
    "Check the NEW answer independently. A reference example is neither a substitute for solving the new question nor proof that its answer is correct.",
  ].join("\n\n");
}
