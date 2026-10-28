// Pure checks applied to a structured lesson BEFORE anything is saved.
// Reuses the existing lesson-note solution contract; adds only the notation
// guard (no calculator / coding syntax) and question/solution pairing.
import { checkSolution } from "@/lib/agent/solutionContract";

export const QUESTION_KINDS = ["example", "exercise", "classwork", "homework"] as const;
export const TEACHING_KINDS = ["introduction", "explanation", "summary"] as const;

export type StructuredQuestion = { question: string; solution: string[]; title?: string };
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
        if (q.solution.filter((l) => l.trim()).length === 0) {
          problems.push({ where: qa, issue: "every question needs its own worked solution" });
          return;
        }
        const fault = checkSolution(q.question, q.solution);
        if (fault) problems.push({ where: qa, issue: fault.reason });
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
