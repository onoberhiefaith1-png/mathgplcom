// MathGPL MATH ENGINE — the independent mathematical intelligence.
//
// This is a SEPARATE prompt family from the Co-Pilot family. The Co-Pilot
// understands the application; the Engine understands mathematics. The Engine
// returns STRUCTURED output (question, givens, target, method, claim, solution
// steps, final answer, diagram model) so the server and the client can
// re-compute the mathematics before anything is displayed.

import { CONSTRUCTION_STANDARD } from "./constructionStandard.ts";

export type EngineOperation =
  | "generateLessonSection" | "generateExample" | "generateClasswork"
  | "generateAssignment" | "analyseQuestion" | "generateSimilarQuestions"
  | "solveQuestion" | "verifySolution" | "generateGeometry" | "verifyGeometry"
  | "analyseUploadedMaterial" | "validateMathematics";

export const ENGINE_IDENTITY = `
You are the MathGPL Math Engine — the mathematical intelligence of a secondary
school mathematics teaching platform. You are NOT a chat assistant and NOT a
software assistant. You produce mathematics for a classroom board.

WHAT YOU ARE ACCOUNTABLE FOR
• Structure before numbers. When a method is requested, every question you
  produce must genuinely be solvable by that method. "Five quadratics solvable
  by factorisation" means all five factorise over the integers — check the
  factor pairs and the discriminant yourself before you commit to the numbers.
• Difficulty is reasoning demand, never digit size. "Harder" means more steps,
  a method the student must choose, reverse reasoning, or a combination of
  results — not bigger numbers.
• Curriculum awareness. KS3, GCSE / O-level, IGCSE and A-level differ in
  vocabulary, notation, number complexity and reasoning demand. Match the level
  you are given.
• Re-derive, never copy. When the teacher supplies a textbook page or a past
  paper, preserve the METHOD and the DEMAND and write fresh mathematics.
• Every final answer must be substituted back into the original question and
  seen to work before you report it.
• If the request is genuinely ambiguous or the material is incomplete, say so
  in "narration" and return no questions. Never invent a question to fill a gap.

THE CLAIM FIELD IS CHECKED BY CODE
For each question, state a machine-checkable claim so the platform can verify
your mathematics without trusting your prose:
  {"kind":"factorisable_quadratic","a":1,"b":-5,"c":6}
  {"kind":"linear_root","a":2,"b":-7,"root":"3.5"}
  {"kind":"quadratic_roots","a":1,"b":-5,"c":6,"roots":["2","3"]}
  {"kind":"arithmetic","expression":"(3+4)×5","value":"35"}
  {"kind":"none"}
Claims are ALWAYS stated for the equation rearranged to zero. For 2x + 5 = 17
that is 2x − 12 = 0, so the claim is {"kind":"linear_root","a":2,"b":-12,"root":"6"}
— never {"a":2,"b":5}. If the mathematics does not fit one of the kinds above,
use {"kind":"none"} rather than a claim that will fail.
A claim that fails re-computation causes the whole generation to be discarded,
so only state one you have actually verified.
`.trim();

const SHAPE = `
Return STRICT JSON only — no markdown, no code fence — exactly this shape:
{
  "narration": "one or two sentences in a teacher's voice about what you produced",
  "analysis": {
    "level": "", "method": "", "style": "", "progression": "",
    "misconceptions": [], "brief": ""
  },
  "questions": [
    {
      "text": "",
      "givens": [{"symbol":"","value":"","unit":""}],
      "target": "",
      "method": "",
      "demand": "single-step | multi-step | method-choice | reverse",
      "claim": {"kind":"none"},
      "solutionSteps": ["one micro-step per line"],
      "finalAnswer": "",
      "diagramRequired": false,
      "diagramDescription": "",
      "labels": []
    }
  ],
  "construction": null
}
For operations that do not produce questions, return "questions": [].
`.trim();

const OPERATION_BRIEF: Record<EngineOperation, string> = {
  generateLessonSection:
    "Produce the mathematical content for one lesson-note section. Introduction and explanation sections carry teaching prose in solutionSteps and no question text beyond the heading idea.",
  generateExample:
    "Produce worked example question(s) with the full classroom solution, one micro-step per line.",
  generateClasswork:
    "Produce classwork question(s) the class can attempt now, with the full solution held for the teacher.",
  generateAssignment:
    "Produce homework/assignment question(s) that extend the lesson, with full solutions.",
  analyseQuestion:
    "Analyse the supplied question: level, method required, reasoning demand, likely misconceptions. Return no new questions.",
  generateSimilarQuestions:
    "Produce fresh questions matching the supplied question's method and reasoning demand. Never reproduce the original numbers.",
  solveQuestion:
    "Solve the supplied question exactly as written. Restate the question verbatim as the first solution step, then one micro-step per line, then substitute the answer back.",
  verifySolution:
    "Check the supplied solution against the supplied question. Report every mathematical error in narration. Return no new questions.",
  generateGeometry:
    "Build the required figure as a CONSTRUCTION PROGRAM (see the construction standard below). State what is mathematically true about the figure; never invent coordinates and never paint a picture.",
  verifyGeometry:
    "Check the supplied diagram summary against the question: every required vertex, angle marker, arc, label and mark. Report mismatches in narration.",
  analyseUploadedMaterial:
    "Read the supplied material and report the mathematics it contains: topic, method, level, style, reasoning demand and misconceptions. Return no new questions.",
  validateMathematics:
    "Re-check the supplied mathematics line by line and report any error in narration. Return no new questions.",
};

export interface EnginePromptInput {
  operation: EngineOperation;
  instruction?: string;
  question?: string;
  solution?: string;
  sectionKind?: string;
  topic?: string;
  subtopic?: string;
  level?: string;
  demand?: string;
  count?: number;
  method?: string;
  sessionContext?: string;
  diagramSummary?: string;
  previousProblems?: string[];
}

export function buildEnginePrompt(input: EnginePromptInput): string {
  const lines: string[] = [
    ENGINE_IDENTITY,
    "",
    `OPERATION: ${input.operation}`,
    OPERATION_BRIEF[input.operation] ?? "",
    "",
  ];
  if (input.topic || input.subtopic) lines.push(`Topic: ${input.topic ?? ""}${input.subtopic ? ` — ${input.subtopic}` : ""}`);
  if (input.sectionKind) lines.push(`Lesson section: ${input.sectionKind}`);
  if (input.level) lines.push(`Curriculum level: ${input.level}`);
  if (input.demand) lines.push(`Required reasoning demand: ${input.demand}`);
  if (input.method) lines.push(`The mathematics MUST require this method: ${input.method}`);
  if (input.count) lines.push(`Produce exactly ${input.count} question(s).`);
  if (input.question) lines.push(`\nQUESTION (verbatim, immutable):\n"""${input.question}"""`);
  if (input.solution) lines.push(`\nSOLUTION UNDER REVIEW:\n"""${input.solution}"""`);
  if (input.diagramSummary) lines.push(`\nEXISTING DIAGRAM:\n${input.diagramSummary}`);
  if (input.sessionContext) lines.push(`\nLESSON SESSION STATE (authoritative):\n${input.sessionContext}`);
  if (input.instruction) lines.push(`\nTEACHER INSTRUCTION:\n"""${input.instruction}"""`);
  if (input.previousProblems?.length) {
    lines.push(
      "\nYOUR PREVIOUS ATTEMPT WAS REJECTED BY THE VERIFIER:",
      ...input.previousProblems.slice(0, 8).map((p) => `• ${p}`),
      "Fix the mathematics itself — do not restate the same numbers with different words.",
    );
  }
  if (["generateGeometry", "verifyGeometry", "generateExample", "generateClasswork",
       "generateAssignment", "generateLessonSection"].includes(input.operation)) {
    lines.push("", CONSTRUCTION_STANDARD);
  }
  lines.push("", SHAPE);
  return lines.join("\n");
}

/* ── deterministic verification, server side ───────────────────────── */

function evalArithmetic(raw: string): number {
  let s = String(raw ?? "")
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))")
    .replace(/\\sqrt\{([^{}]*)\}/g, "Math.sqrt(($1))")
    .replace(/\^\{([^{}]*)\}/g, "**($1)")
    .replace(/\^/g, "**")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/\s+/g, "");
  if (!/^[-+*/().0-9Mathsqrt*]+$/.test(s.replace(/Math\.sqrt/g, ""))) throw new Error("not arithmetic");
  // deno-lint-ignore no-explicit-any
  const value = (new Function(`"use strict";return (${s});`) as any)();
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("not finite");
  return value;
}

/**
 * Parse the Engine's JSON safely. Board notation uses single-backslash LaTeX
 * templates (\frac, \sqrt), and JSON.parse would eat "\f" as a form feed —
 * "\frac{1}{2}" would arrive as "rac{1}{2}". Any backslash that is not a legal
 * JSON escape is doubled before parsing. Output is also often wrapped in prose
 * or code fences, or cut off by a token limit, so we slice the balanced object
 * and, as a last resort, repair an unterminated tail.
 */

// A backslash that does not begin a valid JSON escape sequence.
const BAD_ESCAPE = /\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g;

// A backslash that starts a LaTeX command (\frac, \begin, \sqrt, \text …).
// JSON-wise \f, \b, \n, \r, \t are *valid* escapes, so JSON.parse silently
// mangles "\frac" into a form-feed. Double these before parsing.
const LATEX_ESCAPE = /\\(?=[a-zA-Z])/g;

const stripFences = (s: string) =>
  s.replace(/```[a-zA-Z]*\s*/g, "").replace(/```/g, "").trim();

/** Escape raw control characters (real newlines/tabs) that appear inside strings. */
function escapeRawControls(s: string): string {
  let out = "", inStr = false, esc = false;
  for (const c of s) {
    if (inStr) {
      if (esc) { esc = false; out += c; continue; }
      if (c === "\\") { esc = true; out += c; continue; }
      if (c === '"') { inStr = false; out += c; continue; }
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
      out += c;
      continue;
    }
    if (c === '"') inStr = true;
    out += c;
  }
  return out;
}


/** Slice the first balanced {...} block, ignoring braces inside strings. */
function sliceObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return s.slice(start, i + 1);
  }
  return s.slice(start); // truncated — repaired below
}

/** Close an unterminated string / arrays / objects left by a truncated reply. */
function repairTail(s: string): string {
  let out = s, inStr = false, esc = false;
  const stack: string[] = [];
  for (const c of out) {
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
  }
  if (esc) out = out.slice(0, -1);
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "");
  while (stack.length) out += stack.pop() === "{" ? "}" : "]";
  return out;
}

// deno-lint-ignore no-explicit-any
export function parseEngineJson(raw: string): any {
  const base = stripFences(String(raw ?? ""));
  const candidates = [base, sliceObject(base) ?? ""].filter(Boolean);
  for (const candidate of candidates) {
    for (const text of [candidate, candidate.replace(BAD_ESCAPE, "\\\\")]) {
      try { return JSON.parse(text); } catch { /* try next shape */ }
      try { return JSON.parse(repairTail(text)); } catch { /* try next shape */ }
    }
  }
  return null;
}



const near = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

const num = (raw: unknown): number | null => {
  try { return evalArithmetic(String(raw)); } catch { return null; }
};

// deno-lint-ignore no-explicit-any
export function checkClaim(claim: any): string | null {
  if (!claim || typeof claim !== "object" || claim.kind === "none") return null;
  if (claim.kind === "factorisable_quadratic") {
    const { a, b, c } = claim;
    if (![a, b, c].every((v) => Number.isInteger(v)) || a === 0) {
      return "The quadratic claim does not carry integer coefficients.";
    }
    const disc = b * b - 4 * a * c;
    const r = Math.round(Math.sqrt(Math.max(disc, 0)));
    if (disc < 0 || r * r !== disc) {
      return `${a}x² + ${b}x + ${c} does not factorise over the integers (discriminant ${disc}).`;
    }
    return null;
  }
  if (claim.kind === "linear_root") {
    const root = num(claim.root);
    if (root === null) return `The stated root "${claim.root}" is not a number.`;
    const v = claim.a * root + claim.b;
    return near(v, 0) ? null : `Substituting x = ${claim.root} gives ${v}, not 0.`;
  }
  if (claim.kind === "quadratic_roots") {
    for (const r of claim.roots ?? []) {
      const x = num(r);
      if (x === null) return `The stated root "${r}" is not a number.`;
      const v = claim.a * x * x + claim.b * x + claim.c;
      if (!near(v, 0)) return `Substituting x = ${r} back into the equation gives ${v}, not 0.`;
    }
    return null;
  }
  if (claim.kind === "arithmetic") {
    const left = num(claim.expression);
    const right = num(claim.value);
    if (left === null) return `Could not re-compute ${claim.expression}.`;
    if (right === null) return `The stated value "${claim.value}" is not a number.`;
    return near(left, right) ? null : `${claim.expression} evaluates to ${left}, not ${claim.value}.`;
  }
  return null;
}

const RAW_SYNTAX = /(\d\s*\/\s*\d|sqrt\s*\(|\*\*|\\times|\\cdot|\\left|\\right|```)/;

const NEEDS_QUESTIONS: EngineOperation[] = [
  "generateLessonSection", "generateExample", "generateClasswork", "generateAssignment",
  "generateSimilarQuestions", "solveQuestion",
];

/** Server-side gates. Returns teacher-facing problems; empty = publishable. */
// deno-lint-ignore no-explicit-any
export function engineProblems(operation: EngineOperation, payload: any, opts: { count?: number; method?: string } = {}): string[] {
  const out: string[] = [];
  const questions: any[] = Array.isArray(payload?.questions) ? payload.questions : [];
  if (!NEEDS_QUESTIONS.includes(operation)) return out;
  if (!questions.length) return ["No question was produced."];
  if (opts.count && questions.length < opts.count) {
    out.push(`${opts.count} questions were required but ${questions.length} came back.`);
  }
  questions.forEach((q, i) => {
    const tag = `Question ${i + 1}`;
    const steps: string[] = Array.isArray(q?.solutionSteps) ? q.solutionSteps.map(String) : [];
    if (!String(q?.text ?? "").trim()) out.push(`${tag}: the question text is empty.`);
    if (!steps.length) out.push(`${tag}: no solution steps were produced.`);
    if (!String(q?.finalAnswer ?? "").trim()) out.push(`${tag}: no final answer was produced.`);
    if (RAW_SYNTAX.test(`${q?.text ?? ""}\n${steps.join("\n")}`)) {
      out.push(`${tag}: raw syntax (slash fraction, sqrt(), ** or a LaTeX command) reached the output.`);
    }
    if (opts.method && String(q?.method ?? "") &&
        !String(q.method).toLowerCase().includes(opts.method.toLowerCase()) &&
        !opts.method.toLowerCase().includes(String(q.method).toLowerCase())) {
      out.push(`${tag}: uses "${q.method}" but "${opts.method}" was required.`);
    }
    const claim = checkClaim(q?.claim);
    if (claim) out.push(`${tag}: ${claim}`);
    if (q?.diagramRequired && !(Array.isArray(q?.labels) && q.labels.length)) {
      out.push(`${tag}: a diagram is required but no labels were listed.`);
    }
  });
  return out;
}
