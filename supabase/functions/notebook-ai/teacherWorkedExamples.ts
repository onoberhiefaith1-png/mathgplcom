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
];

function relevantTopics(body: Record<string, any>): Set<string> {
  // Current instructions/question outweigh the notebook's broad title. Never
  // select using previous lesson examples, which can span unrelated subtopics.
  const question = [body.question, body.problem, body.activeQuestion].filter(value => typeof value === "string").join(" ");
  const subtopic = [body.subtopic, body.activeSubtopic, body.snapshot?.activeSubtopic, body.snapshot?.subtopic, body.context?.activeSubtopic, body.context?.subtopic].filter(value => typeof value === "string").join(" ");
  const instruction = [body.selection, body.instruction, body.teacherPrompt, body.material?.text].filter(value => typeof value === "string").join(" ");
  for (const context of [question, subtopic, instruction, [body.topic, body.snapshot?.topic, body.context?.topic].filter(Boolean).join(" ")]) {
    const topics = detectTopics(context.toLowerCase());
    if (topics.size) return topics;
  }
  return new Set<string>();
}

function detectTopics(text: string): Set<string> {
  const topics = new Set<string>();
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
  if (body.mode === "copilot" && !["blueprint", "revise", "analyse"].includes(body.stage)) return "";
  const topics = relevantTopics(body);
  let samples = TEACHER_WORKED_EXAMPLES.filter(sample => topics.has(sample.topic));
  if (topics.has("series")) {
    const text = `${body.question ?? ""} ${body.problem ?? ""} ${body.subtopic ?? ""} ${body.teacherPrompt ?? ""}`;
    const preferred = /infinite|geometric|∞|infty/i.test(text) ? "infinite-geometric-series" : "finite-summation";
    samples = samples.filter(sample => sample.topic !== "series" || sample.id === preferred);
  }
  if (topics.has("analysis")) {
    const text = `${body.question ?? ""} ${body.problem ?? ""} ${body.subtopic ?? ""} ${body.teacherPrompt ?? ""}`;
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
