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
    "Produce the mathematical content for one lesson-note section. Introduction and explanation sections carry the TEACHING PROSE ITSELF in questions[0].solutionSteps — one classroom sentence or stated result per entry, at least four entries, the words the teacher writes on the board. Never return an empty questions array and never summarise the section instead of teaching it; \"analysis.brief\" is a note about the section, not the section.",

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
  if (input.operation === "generateGeometry") {
    lines.push(
      "",
      "FIGURE IS MANDATORY: \"construction\" must NOT be null. The question above",
      "refers to a figure, so return a construction program that contains every",
      "point, line, circle, angle and mark the question names, each lettered",
      "exactly as the question letters them. Never return prose instead of a",
      "construction, and never invent raw coordinates.",
    );
  }

  lines.push("", SHAPE);
  return lines.join("\n");
}

/* ── deterministic verification, server side ───────────────────────── */

/**
 * Read the balanced {...} group starting at `i` (s[i] must be "{").
 * Returns the group's inner text and the index just after its closing brace.
 */
function readBraceGroup(s: string, i: number): [string, number] {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  throw new Error("unbalanced braces");
}

/**
 * Convert board notation into JavaScript arithmetic. Groups are read with a
 * balanced-brace reader, so nested board notation such as
 * \frac{3 - \sqrt{2}}{7} converts correctly, and the plain-text forms teachers
 * type (sqrt(7), 10 / (sqrt(18) - sqrt(2))) are accepted too.
 */
function latexToJs(raw: string): string {
  const src = String(raw ?? "")
    .replace(/\\left|\\right|\\!|\\,|\\;|\\ /g, "")
    .replace(/\\(?:times|cdot)/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\dfrac|\\tfrac/g, "\\frac")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-");

  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("\\frac", i)) {
      let j = i + 5;
      while (src[j] === " ") j++;
      const [a, afterA] = readBraceGroup(src, j);
      let k = afterA;
      while (src[k] === " ") k++;
      const [b, afterB] = readBraceGroup(src, k);
      out += `((${latexToJs(a)})/(${latexToJs(b)}))`;
      i = afterB;
      continue;
    }
    if (src.startsWith("\\sqrt", i) || src.startsWith("sqrt", i)) {
      let j = i + (src[i] === "\\" ? 5 : 4);
      while (src[j] === " ") j++;
      if (src[j] === "{") {
        const [a, after] = readBraceGroup(src, j);
        out += `Math.sqrt((${latexToJs(a)}))`;
        i = after;
        continue;
      }
      if (src[j] === "(") {
        out += "Math.sqrt(";
        i = j + 1;
        continue;
      }
      throw new Error("unreadable root");
    }
    if (src[i] === "^") {
      let j = i + 1;
      while (src[j] === " ") j++;
      if (src[j] === "{") {
        const [a, after] = readBraceGroup(src, j);
        out += `**(${latexToJs(a)})`;
        i = after;
        continue;
      }
      out += "**";
      i = i + 1;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

function evalArithmetic(raw: string): number {
  const s = latexToJs(raw).replace(/\s+/g, "");
  if (!/^[-+*/().0-9]*$/.test(s.replace(/Math\.sqrt/g, ""))) throw new Error("not arithmetic");
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
  let out = s;
  // First close an open string, then drop any half-written tail member: a reply
  // cut mid-member leaves a key with no value, or half a number.
  const scan = (text: string) => {
    let inStr = false, esc = false;
    const stack: string[] = [];
    for (const c of text) {
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
    return { inStr, esc, stack };
  };

  const first = scan(out);
  if (first.esc) out = out.slice(0, -1);
  if (first.inStr) out += '"';

  for (let i = 0; i < 4; i++) {
    const before = out;
    out = out.replace(/[,:]\s*$/, "");
    out = out.replace(/(?:[,{[]\s*)?"(?:[^"\\]|\\.)*"\s*:\s*$/, "");
    out = out.replace(/([,[{]\s*)[-+]?[\d.]+[eE][-+]?$/, "$1");
    out = out.replace(/([,[{]\s*)[-+.]$/, "$1");
    out = out.replace(/[,{[]\s*$/, (m) => (m.trim() === "," ? "" : m));
    if (out === before) break;
  }
  out = out.replace(/,\s*$/, "");

  // The brackets still open are counted AFTER trimming, so a dropped fragment
  // never leaves one closing brace too many.
  const { stack } = scan(out);
  while (stack.length) out += stack.pop() === "{" ? "}" : "]";

  return out;
}


// A construction value sometimes arrives as arithmetic the model did not work
// out, e.g. "angle": 180 + 105. JSON has no expressions, so compute the value.
const NUMERIC_EXPRESSION = /:\s*(-?\d+(?:\.\d+)?(?:\s*[-+*/]\s*-?\d+(?:\.\d+)?)+)\s*(?=[,}\]])/g;
// A string value sometimes loses its opening quote, e.g. "op": intersect",
const UNOPENED_STRING = /:\s*([A-Za-z_][A-Za-z0-9_]*)"(\s*[,}\]])/g;
function foldNumericExpressions(s: string): string {
  return s
    .replace(UNOPENED_STRING, ': "$1"$2')
    .replace(NUMERIC_EXPRESSION, (whole, expr: string) => {
      try {
        const v = evalArithmetic(expr);
        return Number.isFinite(v) ? `: ${v}` : whole;
      } catch { return whole; }
    });
}


// deno-lint-ignore no-explicit-any
export function parseEngineJson(raw: string): any {
  const base = stripFences(String(raw ?? ""));
  if (!base) return null;
  const shapes: string[] = [];
  for (const candidate of [base, sliceObject(base) ?? ""]) {
    if (!candidate) continue;
    // Strict shape first, then progressively repaired shapes. LaTeX repair is
    // only reached when the strict parse fails, so correctly escaped input is
    // never mangled.
    const latex = candidate.replace(LATEX_ESCAPE, "\\\\");
    for (const fixed of [candidate, latex, latex.replace(BAD_ESCAPE, "\\\\"), candidate.replace(BAD_ESCAPE, "\\\\")]) {
      shapes.push(fixed, escapeRawControls(fixed), foldNumericExpressions(escapeRawControls(fixed)));
    }
  }
  for (const text of shapes) {
    try { return JSON.parse(text); } catch { /* try next shape */ }
    try { return JSON.parse(repairTail(text)); } catch { /* try next shape */ }

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
