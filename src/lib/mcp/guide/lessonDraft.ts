import { parse } from "mathjs";
import { boardToMathjs, evaluatesEqual } from "@/lib/mathengine/exactEval";
import { validateStructuredLesson, QUESTION_KINDS, TEACHING_KINDS, type LessonProblem, type StructuredSection } from "./lessonValidator";

export type AnswerCheck =
  | { kind: "equation_solution"; equation: string; variable: string; value: string; answerLine: number }
  | { kind: "arithmetic"; expression: string; value: string; answerLine: number };
export type SectionKind = typeof QUESTION_KINDS[number] | typeof TEACHING_KINDS[number];
export type LessonCounts = Partial<Record<SectionKind, number>>;
export interface LessonDraft {
  notebookId?: string;
  title?: string;
  subject: string;
  subtopic: string;
  className?: string;
  teacher?: string;
  expectedCounts?: LessonCounts;
  sections: StructuredSection[];
}
export interface AnswerCheckResult {
  where: string;
  kind: AnswerCheck["kind"];
  passed: boolean;
  exact: boolean;
  issue?: string;
}

// Preserve inequality signs, exponents and all mathematical conditions.
const compact = (s: string) => s.normalize("NFC").replace(/[−–]/g, "-").replace(/\s+/g, "");
const FUNCTIONS = new Set(["sqrt", "nthRoot", "sin", "cos", "tan", "asin", "acos", "atan", "log", "abs", "exp"]);
const questionSource = (question: string) => question.trim().replace(/^(?:solve|evaluate|calculate|simplify|work out)\s+/i, "").replace(/[?.]$/, "").trim();

function containsMathFragment(question: string, fragment: string): boolean {
  const source = question.normalize("NFC").replace(/[−–]/g, "-");
  const needle = compact(fragment);
  if (!needle) return false;
  const pattern = [...needle].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
  for (const hit of source.matchAll(new RegExp(pattern, "g"))) {
    const start = hit.index!; const end = start + hit[0].length;
    const before = source.slice(0, start); const after = source.slice(end);
    if (/[\p{L}\p{N}_]/u.test(before.at(-1) ?? "") || /^[\p{L}\p{N}_]/u.test(after)) continue;
    if (/[+\-×÷*/^=<>≤≥]$/.test(before.trimEnd()) || /^[+\-×÷*/^=<>≤≥]|^\.\d/.test(after.trimStart())) continue;
    return true;
  }
  return false;
}

/** Checks only constant arithmetic, never assignments, objects or executable expressions. */
function safeConstant(expr: string): boolean {
  if (!expr.trim() || expr.length > 2000) return false;
  try {
    let safe = true;
    parse(boardToMathjs(expr)).traverse((node: any) => {
      if (!["ConstantNode", "SymbolNode", "OperatorNode", "FunctionNode", "ParenthesisNode"].includes(node.type)) safe = false;
      if (node.isConstantNode && typeof node.value !== "number") safe = false;
      if (node.isSymbolNode && !["pi", "e"].includes(node.name) && !FUNCTIONS.has(node.name)) safe = false;
      if (node.isFunctionNode && !FUNCTIONS.has(node.fn?.name)) safe = false;
      if (node.isOperatorNode && !["+", "-", "*", "/", "^"].includes(node.op)) safe = false;
    });
    return safe;
  } catch { return false; }
}

const substituteLetter = (expr: string, variable: string, value: string) =>
  expr.replace(new RegExp(`(?<![A-Za-z])${variable}(?![A-Za-z])`, "g"), `(${value})`);

/** Straightforward questions cannot avoid answer checking by omitting claims. */
function inferAnswerCheck(question: string, solution: string[]): AnswerCheck | null {
  const expression = questionSource(question);
  const answer = solution.at(-1)?.trim().replace(/^(?:answer|result|final answer):\s*/i, "") ?? "";
  const sides = expression.split("=");
  const final = answer.split("=");
  if (sides.length === 2 && final.length === 2 && /^[a-z]$/i.test(final[0].trim()) && !/[<>≤≥]/.test(expression)) {
    const variable = final[0].trim(); const value = final[1].trim();
    if (sides.every(s => safeConstant(substituteLetter(s, variable, value)))) {
      return { kind: "equation_solution", equation: expression, variable, value, answerLine: solution.length };
    }
  }
  if (sides.length === 1 && safeConstant(expression) && final.length <= 2 && safeConstant(final.at(-1) ?? "")) {
    return { kind: "arithmetic", expression, value: final.at(-1)!.trim(), answerLine: solution.length };
  }
  return null;
}

function checkAnswer(question: string, solution: string[], check: AnswerCheck, where: string): AnswerCheckResult {
  const fail = (issue: string): AnswerCheckResult => ({ where, kind: check.kind, passed: false, exact: false, issue });
  const answer = solution[check.answerLine - 1]?.trim().replace(/^(?:answer|result|final answer):\s*/i, "");
  if (!answer || check.answerLine < 2 || check.answerLine !== solution.length) {
    return fail("answerLine must identify the final solution line (1-based), after the question restatement");
  }
  let left: string;
  let right: string;
  if (check.kind === "equation_solution") {
    if (!/^[a-z]$/i.test(check.variable)) return fail("equation checks need one named letter variable");
    if (!containsMathFragment(question, check.equation)) return fail("the checked equation must occur as a complete mathematical fragment in the actual question, not an unrelated or partial equation");
    const sides = check.equation.split("=");
    if (sides.length !== 2 || !sides.every(s => s.trim())) return fail("provide one complete equation with two sides");
    const displayed = answer.split("=");
    if (displayed.length !== 2 || compact(displayed[0]) !== compact(check.variable) || compact(displayed[1]) !== compact(check.value)) {
      return fail("the checked value must be the displayed final answer for the named variable");
    }
    // A digit touching a variable is implicit multiplication (2x), not part
    // of an identifier. Whole-word substitution would miss these equations.
    left = substituteLetter(sides[0], check.variable, check.value);
    right = substituteLetter(sides[1], check.variable, check.value);
  } else {
    if (!containsMathFragment(question, check.expression)) return fail("the arithmetic expression must occur as a complete mathematical fragment in the actual question");
    const displayed = answer.split("=");
    if (displayed.length > 2 || compact(displayed.at(-1) ?? "") !== compact(check.value)) return fail("the checked value must match the displayed final answer");
    if (displayed.length === 2 && compact(displayed[0]) !== compact(check.expression)) return fail("the final arithmetic line must show the expression being checked");
    left = check.expression;
    right = check.value;
  }
  if (!safeConstant(left) || !safeConstant(right)) return fail("this expression is outside the supported constant-arithmetic checker; remove the claim and request teacher review");
  try {
    const result = evaluatesEqual(left, right);
    if (!result.ok) return fail("the displayed answer does not satisfy the original question");
    return { where, kind: check.kind, passed: true, exact: result.exact };
  } catch { return fail("mathematical checking was unavailable; this is not a pass"); }
}

export function reviewLessonDraft(draft: LessonDraft) {
  const problems: LessonProblem[] = validateStructuredLesson(draft.sections);
  if (!draft.notebookId && !draft.title?.trim()) problems.push({ where: "lesson", issue: "a new lesson needs a title" });
  const counts: Record<SectionKind, number> = { introduction: 0, explanation: 0, summary: 0, example: 0, exercise: 0, classwork: 0, homework: 0 };
  const checks: AnswerCheckResult[] = [];
  const reviewRequired: LessonProblem[] = [];
  draft.sections.forEach((s, si) => {
    counts[s.kind] += "questions" in s ? s.questions.length : 1;
    if (!("questions" in s)) {
      if (s.lines.some(line => /[=<>≤≥]/.test(line))) reviewRequired.push({
        where: `section ${si + 1} (${s.kind})`, issue: "mathematical relations in teaching prose are outside the question-answer checker; teacher review required",
      });
      return;
    }
    s.questions.forEach((q, qi) => {
      const where = `section ${si + 1} (${s.kind}), question ${qi + 1}`;
      const inferred = inferAnswerCheck(q.question, q.solution);
      const supplied = [...(q.checks ?? [])];
      if (inferred && !supplied.some(c => c.kind === inferred.kind && c.answerLine === inferred.answerLine &&
        c.value === inferred.value && (c.kind === "equation_solution" && inferred.kind === "equation_solution"
          ? compact(c.equation) === compact(inferred.equation) && c.variable === inferred.variable
          : c.kind === "arithmetic" && inferred.kind === "arithmetic" && compact(c.expression) === compact(inferred.expression)))) supplied.push(inferred);
      if (/[<>≤≥]/.test(q.question) || (q.question.match(/=/g) ?? []).length > 1 || /[²³⁴⁵⁶⁷⁸⁹]|\^|\\(?:sqrt|frac)|\b(?:prove|all solutions|sin|cos|tan|log)\b/i.test(q.question)) {
        reviewRequired.push({ where, issue: "review domains, inequalities, all required roots or proof reasoning; a numerical answer check alone does not cover these" });
      }
      if (!supplied.length) {
        reviewRequired.push({ where, issue: "no machine-checkable answer was supplied; the teacher must review this mathematics explicitly" });
      }
      for (const claim of supplied) {
        const result = checkAnswer(q.question, q.solution, claim, where);
        checks.push(result);
        if (!result.passed) problems.push({ where, issue: result.issue! });
        else if (!result.exact) reviewRequired.push({ where, issue: "the answer check used numerical tolerance, not an exact proof; review required" });
        const checkedSource = claim.kind === "equation_solution" ? claim.equation : claim.expression;
        if (result.passed && compact(questionSource(q.question)) !== compact(checkedSource)) reviewRequired.push({
          where, issue: "this check covers an equation/expression within a larger question; review the remaining wording, conditions and target",
        });
      }
    });
  });
  for (const [kind, expected] of Object.entries(draft.expectedCounts ?? {})) {
    if (expected === undefined) continue;
    const actual = counts[kind as SectionKind];
    if (actual !== expected) problems.push({ where: "lesson counts", issue: `${kind}: requested ${expected}, produced ${actual}` });
  }
  return { ok: problems.length === 0, problems, counts, checks, reviewRequired,
    mathematics: checks.some(c => !c.passed) ? "failed" as const : reviewRequired.length ? "needs_teacher_review" as const : checks.length ? "checked_answers" as const : "no_questions" as const,
    scope: "Checks supplied or inferred final numerical answers against the question; does not prove all intermediate steps, domains, completeness of roots, proofs or diagram reasoning." };
}

/** The approval covers metadata, counts, every line and every mathematical check. */
export async function draftDigest(draft: LessonDraft): Promise<string> {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
    return value;
  };
  const bytes = new TextEncoder().encode(JSON.stringify(stable(draft)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
