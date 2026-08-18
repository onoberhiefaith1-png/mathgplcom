// PROBLEM IDENTIFICATION & VALIDATION
//
// The teacher already has the mathematical problem on the page before clicking
// "Generate Solution". The system must therefore never conclude "no problem
// found" just because the content also carries structural labels
// ("Classwork 4", "Example 3:", "Question 2") or interface metadata
// ("AI", "#FLOATING", "ASSIGN").
//
// The application owns the STRUCTURE. The AI owns the MATHEMATICS.
// This module separates the two on the document data we already hold — no OCR,
// no screenshot. Visual analysis stays a later fallback only.

export type ProblemStatus =
  | "valid"       // mathematics present and usable
  | "uncertain"   // a question exists but the AI cannot fully confirm it
  | "incomplete"  // a question exists but part of it is missing
  | "ambiguous"   // conflicting candidates
  | "empty";      // nothing but labels / metadata

export interface ProblemReport {
  status: ProblemStatus;
  /** Structural labels that were detected and set aside. */
  labels: string[];
  /** The imperative task line, when one exists. */
  instruction: string;
  /** The mathematical problem, labels removed — this is ACTIVE_QUESTION. */
  problem: string;
  /** Lines classified as mathematics. */
  mathLines: string[];
  hasDiagram: boolean;
  /** Plain-language description of what is wrong (empty when valid). */
  issue: string;
  /** Where the mathematics was found — the block itself, its Solution, its
   *  diagram, or elsewhere in the session. Shown in the Problem Check panel. */
  sources: string[];
}

/** Content belonging to the same question / session, used when the clicked
 *  block alone does not carry the mathematics. */
export interface RelatedProblemContent {
  /** Solution text of the same question. */
  solutionText?: string;
  /** Text inventory of the diagram owned by the same question. */
  diagramSummary?: string;
  /** Mathematics found elsewhere in the same session. */
  sessionText?: string;
}


/* ------------------------------------------------------------------ labels */

const LABEL_WORDS = [
  "example", "examples", "exercise", "exercises", "classwork", "class work",
  "homework", "home work", "question", "questions", "problem", "problems",
  "solution", "solutions", "answer", "answers", "working", "workings",
  "assessment", "quiz", "test", "activity", "task", "session", "objectives",
  "summary", "introduction", "explanation",
];

/** `Classwork 4`, `Example 3:`, `Exercise 5 -`, `Question (2)`, `Solution` …
 *  The label must be followed by a number, punctuation, or the end of the line,
 *  so ordinary sentences ("Test the value of x") are never mistaken for one. */
const LABEL_PREFIX = new RegExp(
  `^\\s*(?:${LABEL_WORDS.join("|")})(?:\\s*\\(?\\s*\\d{1,3}\\s*\\)?)?\\s*(?:[:.)\\-–—]\\s*|$)`,
  "i",
);


/** Interface metadata chips that can be picked up as text. */
const METADATA_LINE = /^\s*(?:ai|#?floating(?:\s*numbers?)?|assign(?:ment)?|edit|generate|regenerate|clear|check|marks?)\s*$/i;

/** Does this whole line consist of nothing but a structural label? */
export function isStructuralLabelLine(line: string): boolean {
  const t = (line || "").trim();
  if (!t) return false;
  if (METADATA_LINE.test(t)) return true;
  const rest = t.replace(LABEL_PREFIX, "").trim();
  return rest.length === 0 && LABEL_PREFIX.test(t);
}

/**
 * Remove a leading structural label from ONE line, keeping whatever follows.
 * `Classwork 4: Solve …` → `Solve …`; `Classwork 4` → `` (label only).
 */
export function stripLeadingStructuralLabel(line: string): { label: string; rest: string } {
  const t = (line || "").trim();
  if (!t) return { label: "", rest: "" };
  if (METADATA_LINE.test(t)) return { label: t, rest: "" };
  const m = LABEL_PREFIX.exec(t);
  if (!m || !m[0].trim()) return { label: "", rest: t };
  return { label: m[0].trim().replace(/[:.)\-–—]\s*$/, ""), rest: t.slice(m[0].length).trim() };
}

/**
 * Drop a duplicated structural heading the application already renders.
 * Used defensively on AI output: the label is removed, the mathematics kept.
 * Never treats the duplicate as a failure.
 */
export function stripDuplicateHeading(text: string, existingHeading?: string): string {
  const lines = String(text ?? "").split("\n");
  let i = 0;
  // Only ever consider the first two leading lines, so real content is safe.
  let removed = 0;
  while (i < lines.length && removed < 2) {
    const raw = lines[i];
    if (!raw.trim()) { i++; continue; }
    const { label, rest } = stripLeadingStructuralLabel(raw);
    if (!label) break;
    const headingMatches =
      !existingHeading ||
      normalizeLabel(existingHeading).startsWith(normalizeLabel(label)) ||
      normalizeLabel(label).startsWith(normalizeLabel(existingHeading));
    if (!headingMatches) break;
    if (rest) { lines[i] = rest; removed++; break; }
    lines.splice(i, 1);
    removed++;
  }
  return lines.join("\n").replace(/^\n+/, "");
}

const normalizeLabel = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* ------------------------------------------------------ content classifying */

const MATH_HINT = /[0-9=+\-−×÷·^_/<>≤≥≠≈→±√∑∏∫∞°πθ∠]|\\[a-zA-Z]+|\b(?:log|ln|sin|cos|tan|sqrt|frac)\b/;

const INSTRUCTION_VERB =
  /\b(solve|find|calculate|evaluate|simplify|factori[sz]e|expand|differentiate|integrate|determine|prove|show|sketch|draw|plot|convert|express|rationali[sz]e|complete|work out|state|hence|round|estimate|construct|verify|list|copy)\b/i;

/** A line that carries real mathematics (not just an instruction sentence). */
function isMathLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (!MATH_HINT.test(t)) return false;
  // "Solve the following equation:" contains no maths despite the colon.
  const wordy = t.replace(/[^A-Za-z ]/g, "").trim().split(/\s+/).filter(Boolean);
  const hasRelationOrSymbol = /[=<>≤≥≠≈]|\\[a-zA-Z]+|[+\-−×÷·^_/√∑∏∫∠°]/.test(t);
  if (wordy.length >= 6 && !hasRelationOrSymbol) return false;
  return true;
}

/** Mathematics that is cut off: trailing relation/operator, or unbalanced. */
function isTruncatedMath(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/[=+\-−×÷·^_/<>≤≥≠≈,]$/.test(t)) return true;
  const open = (t.match(/[({[]/g) ?? []).length;
  const close = (t.match(/[)}\]]/g) ?? []).length;
  return open > close;
}

/** A question whose data lives in a figure ("Find ∠ABC", "the diagram shows"). */
function needsFigure(text: string): boolean {
  return /∠|\bangle\b|\bdiagram\b|\bfigure\b|\bshown\b|\btriangle\b|\bcircle\b/i.test(text);
}

/* ------------------------------------------------------------------ report */

/**
 * Inspect the clicked block, and — when that block alone does not carry the
 * mathematics — the rest of the same question and session. The question, its
 * diagram and its solution are one unit: mathematics found in any of them is
 * mathematics found.
 */
export function analyzeProblem(
  rawText: string,
  opts?: { heading?: string; hasDiagram?: boolean; related?: RelatedProblemContent },
): ProblemReport {
  const related = opts?.related ?? {};
  const relatedSolution = (related.solutionText ?? "").trim();
  const relatedSession = (related.sessionText ?? "").trim();
  const diagramSummary = (related.diagramSummary ?? "").trim();
  const hasDiagram = Boolean(opts?.hasDiagram) || Boolean(diagramSummary);
  const labels: string[] = [];
  const kept: string[] = [];

  for (const raw of String(rawText ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const { label, rest } = stripLeadingStructuralLabel(line);
    if (label) labels.push(label);
    if (rest) kept.push(rest);
  }

  const mathLines = kept.filter(isMathLine);
  const instructionLines = kept.filter((l) => !isMathLine(l) && INSTRUCTION_VERB.test(l));
  const instruction = instructionLines[0] ?? "";
  const problem = kept.join("\n").trim();

  const relatedMath = (text: string): string[] =>
    text
      .split("\n")
      .map((l) => stripLeadingStructuralLabel(l).rest)
      .filter((l) => l && isMathLine(l));

  const solutionMath = relatedMath(relatedSolution);
  const sessionMath = relatedMath(relatedSession);

  const sources: string[] = [];
  if (mathLines.length) sources.push("mathematics in this block");
  if (hasDiagram) {
    sources.push(
      diagramSummary
        ? `a diagram belonging to this question (${diagramSummary})`
        : "a diagram belonging to this question",
    );
  }
  if (solutionMath.length) sources.push("mathematics in the Solution of this question");
  if (sessionMath.length) sources.push("mathematics elsewhere in this session");

  const base = {
    labels: Array.from(new Set(labels)),
    instruction,
    problem,
    mathLines,
    hasDiagram,
    sources,
  };

  if (!problem) {
    // The block is blank, but the question may still exist as a figure or as
    // working already written under the Solution heading.
    if (hasDiagram || solutionMath.length) {
      return {
        ...base,
        status: "valid",
        issue: "",
      };
    }
    if (sessionMath.length) {
      return {
        ...base,
        status: "uncertain",
        issue:
          "This block is empty, but mathematics was found elsewhere in this session. " +
          "A new question will be generated to continue it.",
      };
    }
    return {
      ...base,
      status: "empty",
      issue: labels.length
        ? "Only section labels were found — nothing has been written in this session yet."
        : "Nothing was found in this session yet, so a new question will be generated from the topic.",
    };
  }

  if (mathLines.length === 0) {
    if (hasDiagram) {
      // The figure carries the data: "Find the value of x" plus a diagram is a
      // complete question.
      return { ...base, status: "valid", issue: "" };
    }
    if (solutionMath.length) {
      return { ...base, status: "valid", issue: "" };
    }
    if (needsFigure(problem)) {
      return {
        ...base,
        status: "uncertain",
        issue:
          "This question refers to a figure, but no diagram was found for it in this session. " +
          "Generation can continue — check the result against the question.",
      };
    }
    return {
      ...base,
      status: "incomplete",
      issue: instruction
        ? "An instruction was found, but no mathematics was found in this block, its Solution or its diagram."
        : "No mathematical expression was detected in this question.",
    };
  }

  const truncated = mathLines.find(isTruncatedMath);
  if (truncated) {
    return {
      ...base,
      status: "incomplete",
      issue: `The mathematics appears cut off: “${truncated}”. Complete it and try again.`,
    };
  }

  if (needsFigure(problem) && !hasDiagram && mathLines.every((l) => !/[=<>≤≥]/.test(l))) {
    return {
      ...base,
      status: "uncertain",
      issue: "This question refers to a figure, but no supporting diagram or numerical information was detected.",
    };
  }

  // Several unrelated relations with no instruction to tie them together.
  const relations = mathLines.filter((l) => /[=<>≤≥]/.test(l));
  if (!instruction && relations.length > 2) {
    return {
      ...base,
      status: "ambiguous",
      issue: "Several separate expressions were detected and no instruction says which one to solve.",
    };
  }

  return { ...base, status: "valid", issue: "" };
}


/** Human title for the check panel. */
export function statusTitle(status: ProblemStatus): string {
  switch (status) {
    case "valid": return "Mathematical question detected";
    case "uncertain": return "A question was detected, but please review it";
    case "incomplete": return "The question appears incomplete";
    case "ambiguous": return "The question is ambiguous";
    case "empty": return "No mathematical question has been written yet";
  }
}
