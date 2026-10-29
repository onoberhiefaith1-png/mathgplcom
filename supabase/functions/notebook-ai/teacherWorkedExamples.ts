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
];

function relevantTopics(body: Record<string, any>): Set<string> {
  // Current instructions/question outweigh the notebook's broad title. Never
  // select using previous lesson examples, which can span unrelated subtopics.
  const question = [body.question, body.problem, body.activeQuestion].filter(value => typeof value === "string").join(" ");
  const subtopic = [body.subtopic, body.snapshot?.subtopic, body.context?.subtopic].filter(value => typeof value === "string").join(" ");
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
  if (/calculus/.test(text) && !topics.has("differentiation") && !topics.has("integration")) {
    topics.add("differentiation"); topics.add("integration");
  }
  return topics;
}

export function teacherWorkedExamplesForRequest(body: Record<string, any>): string {
  if (body.mode === "copilot" && !["blueprint", "revise", "analyse"].includes(body.stage)) return "";
  const topics = relevantTopics(body);
  let samples = TEACHER_WORKED_EXAMPLES.filter(sample => topics.has(sample.topic));
  if (topics.has("analysis")) {
    const text = `${body.question ?? ""} ${body.problem ?? ""} ${body.subtopic ?? ""} ${body.teacherPrompt ?? ""}`;
    const preferred = /continu/i.test(text) ? "analysis-continuity" : "analysis-sequence";
    samples = samples.filter(sample => sample.topic !== "analysis" || sample.id === preferred);
  }
  samples = samples.slice(0, 2);
  if (!samples.length) return "";
  return [
    "REVIEWED TEACHER-STYLE REFERENCES — learn the arrangement, not the numbers.",
    "These are reference questions only. Solve the actual teacher question, retain its exact inputs and requested counts, and match its curriculum level.",
    ...samples.map(sample => [
      `Reference: ${sample.id}`, sample.question, ...sample.working,
      `Review checks: ${sample.checks.join(" ")}`,
    ].join("\n")),
    "Check the NEW answer independently. A reference example is neither a substitute for solving the new question nor proof that its answer is correct.",
  ].join("\n\n");
}
