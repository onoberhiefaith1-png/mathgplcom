// Pure checks applied to a structured lesson BEFORE anything is saved.
// Reuses the existing lesson-note solution contract; adds only the notation
// guard (no calculator / coding syntax) and question/solution pairing.
import { checkSolution } from "@/lib/agent/solutionContract";
import type { AnswerCheck } from "./lessonDraft";

export const QUESTION_KINDS = ["example", "exercise", "classwork", "homework"] as const;
export const TEACHING_KINDS = ["introduction", "explanation", "summary"] as const;

export type StructuredQuestion = { question: string; solution: string[]; title?: string; checks?: AnswerCheck[] };
export type StructuredSection =
  | { kind: (typeof TEACHING_KINDS)[number]; title?: string; lines: string[] }
  | { kind: (typeof QUESTION_KINDS)[number]; title?: string; questions: StructuredQuestion[] };

export type LessonProblem = { where: string; issue: string };

/** Calculator / programming notation the classroom standard forbids. */
export function notationFault(line: string): string | null {
  if (/\*\*/.test(line)) return 'uses "**" for powers — write a superscript such as x^2';
  if (/\d\s*\*\s*[\d(a-z]|\)\s*\*/i.test(line)) return 'uses "*" for multiplication — write × or juxtaposition';
  if (/\bsqrt\s*\(/i.test(line)) return 'uses "sqrt(" — write √ instead';
  if (/(==|!=|&&|\|\|)/.test(line)) return "uses programming operators";
  if (/(?<![\w/])-?\d+\s*\/\s*-?\d+(?![\w/])|\)\s*\/\s*\(/.test(line)) return "uses a slash fraction — use a renderer-supported stacked fraction template";
  if (/\[\[tool:|\[DIAGRAM\b|\\begin\{.*matrix/i.test(line)) return "contains an unsupported native-object directive; do not save it as ordinary text";
  return null;
}

export function validateStructuredLesson(sections: StructuredSection[]): LessonProblem[] {
  const problems: LessonProblem[] = [];
  if (sections.length === 0) problems.push({ where: "lesson", issue: "the lesson has no sections" });
  sections.forEach((s, si) => {
    const at = `section ${si + 1} (${s.kind})`;
    if ("questions" in s) {
      if (s.questions.length === 0) problems.push({ where: at, issue: "a question section needs at least one question" });
      s.questions.forEach((q, qi) => {
        const qa = `${at}, question ${qi + 1}`;
        if (!q.question.trim()) problems.push({ where: qa, issue: "the question text is empty" });
        const questionNotation = notationFault(q.question);
        if (questionNotation) problems.push({ where: qa, issue: questionNotation });
        if (q.solution.filter((l) => l.trim()).length === 0) {
          problems.push({ where: qa, issue: "every question needs its own worked solution" });
          return;
        }
        const fault = checkSolution(q.question, q.solution);
        if (fault) problems.push({ where: qa, issue: fault.reason });
        const exactQuestion = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
        if (exactQuestion(q.solution[0] ?? "") !== exactQuestion(q.question)) {
          problems.push({ where: qa, issue: "line one must preserve the question, including inequality signs, exponents and conditions" });
        }
        const working = q.solution.slice(1).filter(l => l.trim());
        const meaningful = working.filter(l => !/^(done|finished|completed|solved|ok)[.!]?$/i.test(l.trim()));
        if (meaningful.length < 2) {
          problems.push({ where: qa, issue: "provide a method or explanation and complete working with a final result; a bare answer or 'Done' is not a worked solution" });
        }
        q.solution.forEach((line, li) => {
          const n = notationFault(line);
          if (n) problems.push({ where: `${qa}, solution line ${li + 1}`, issue: n });
        });
      });
    } else {
      if (s.lines.filter((l) => l.trim()).length === 0) problems.push({ where: at, issue: "teaching section is empty" });
      s.lines.forEach((line, li) => {
        const n = notationFault(line);
        if (n) problems.push({ where: `${at}, line ${li + 1}`, issue: n });
      });
    }
  });
  return problems;
}
