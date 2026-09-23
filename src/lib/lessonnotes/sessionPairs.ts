// QUESTION SESSION → SOLUTION SESSION.
//
// Every question that needs a solution is followed directly by its own
// Solution session, one pair at a time:
//   Classwork 1 → Solution 1 → Classwork 2 → Solution 2 …
// never "all questions then all solutions", never question + solution in one
// session, and never a question with no Solution session.
//
// Two pure pieces live here:
//   - `validateSessionPairs(doc)` names every place the note breaks that rule;
//   - `applyRestructurePlan(doc, plan)` rebuilds a note from a classification
//     of its top-level blocks (produced by the notebook-ai `restructure` mode),
//     keeping every existing block and every existing solution.

import { buildLessonOutline } from "@/lib/lessonnotes/lessonOutline";
import {
  SECTION_LABELS,
  SOLUTION_SECTION_KINDS,
  type SectionKind,
} from "@/lib/lessonnotes/sectionKinds";

type Node = { type: string; attrs?: Record<string, any> | null; content?: Node[]; text?: string };

export type PairProblemCode =
  | "missing_solution"
  | "solution_not_next"
  | "grouped_solutions"
  | "orphan_solution"
  | "ordinal_mismatch";

export interface PairProblem {
  code: PairProblemCode;
  label: string;
  message: string;
}

const needsSolution = (k: SectionKind) => SOLUTION_SECTION_KINDS.has(k);

export function validateSessionPairs(doc: any): { ok: boolean; problems: PairProblem[] } {
  const segs = buildLessonOutline(doc).filter((s) => !(s.implicit && s.nodes.length === 0));
  const problems: PairProblem[] = [];
  let runOfQuestionsWithoutSolution = 0;

  for (let i = 0; i < segs.length; i += 1) {
    const s = segs[i];
    if (s.isSolution) {
      const prev = segs[i - 1];
      if (!prev || !needsSolution(prev.kind)) {
        problems.push({
          code: runOfQuestionsWithoutSolution > 1 ? "grouped_solutions" : "orphan_solution",
          label: s.label,
          message:
            runOfQuestionsWithoutSolution > 1
              ? `${s.label} comes after a block of questions instead of straight after its own question.`
              : `${s.label} is not directly after a question.`,
        });
      } else if (prev.ordinal !== s.ordinal) {
        problems.push({
          code: "ordinal_mismatch",
          label: s.label,
          message: `${s.label} follows ${prev.label}; the numbers must match.`,
        });
      }
      runOfQuestionsWithoutSolution = 0;
      continue;
    }
    if (needsSolution(s.kind)) {
      const next = segs[i + 1];
      if (!next || !next.isSolution) {
        runOfQuestionsWithoutSolution += 1;
        const later = segs.slice(i + 1).some((x) => x.isSolution);
        problems.push({
          code: later ? "solution_not_next" : "missing_solution",
          label: s.label,
          message: later
            ? `${s.label} is not followed directly by its Solution session.`
            : `${s.label} has no Solution session.`,
        });
      }
    } else {
      runOfQuestionsWithoutSolution = 0;
    }
  }
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Restructure
// ---------------------------------------------------------------------------

export type SegmentRole = "content" | "question" | "solution";

export interface PlanSegment {
  kind: SectionKind;
  role: SegmentRole;
  /** Indices into the note's top-level blocks. Headings may be omitted. */
  blocks: number[];
  /** For a solution: index (in plan.segments) of the question it answers. */
  pairsWith?: number | null;
  /** Optional tidied wording, keyed by block index. Only applied to plain-text
   *  paragraphs whose numbers are unchanged. */
  tidied?: Record<string, string>;
}

export interface RestructurePlan {
  segments: PlanSegment[];
}

export interface RestructureReport {
  sessions: number;
  pairs: number;
  movedSolutions: number;
  tidiedLines: number;
  /** Labels of questions that still need a solution written. */
  needsSolution: { label: string; questionId: string }[];
}

const newId = () => `q_${Math.random().toString(36).slice(2, 10)}`;

const hasMath = (n: Node): boolean =>
  n.type === "mathInline" || n.type === "mathBlock" || n.type === "mathStructure" ||
  (n.content ?? []).some(hasMath);

const plainText = (n: Node): string =>
  typeof n.text === "string" ? n.text : (n.content ?? []).map(plainText).join("");

const numbersOf = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).sort().join(",");

/** A tidied line is only accepted when the mathematics cannot have changed. */
export function safeTidy(original: Node, tidied: string | undefined): Node | null {
  if (!tidied || original.type !== "paragraph" || hasMath(original)) return null;
  const before = plainText(original);
  const after = tidied.trim();
  if (!after || after === before.trim()) return null;
  if (numbersOf(before) !== numbersOf(after)) return null;
  return { type: "paragraph", content: [{ type: "text", text: after }] };
}

const isStructuralHeading = (n: Node) => n.type === "heading";

export function applyRestructurePlan(
  doc: { type: string; content?: Node[] },
  plan: RestructurePlan,
): { doc: { type: string; content: Node[] }; report: RestructureReport } {
  const top = Array.isArray(doc.content) ? doc.content : [];
  const used = new Set<number>();
  const segments = (plan.segments ?? []).filter((s) => s && Array.isArray(s.blocks));
  const counters = new Map<SectionKind, number>();
  const report: RestructureReport = {
    sessions: 0, pairs: 0, movedSolutions: 0, tidiedLines: 0, needsSolution: [],
  };

  // Which solution segment answers each question segment.
  const solutionFor = new Map<number, number>();
  segments.forEach((s, i) => {
    if (s.role !== "solution") return;
    let q = typeof s.pairsWith === "number" ? s.pairsWith : -1;
    if (q < 0 || segments[q]?.role !== "question") {
      for (let j = i - 1; j >= 0; j -= 1) {
        if (segments[j].role === "question" && !solutionFor.has(j)) { q = j; break; }
      }
    }
    if (q >= 0 && !solutionFor.has(q)) solutionFor.set(q, i);
  });

  const bodyOf = (s: PlanSegment): Node[] => {
    const out: Node[] = [];
    for (const idx of [...s.blocks].sort((a, b) => a - b)) {
      const n = top[idx];
      if (!n || used.has(idx)) continue;
      used.add(idx);
      if (isStructuralHeading(n)) continue; // headings are rebuilt
      const tidy = safeTidy(n, s.tidied?.[String(idx)]);
      if (tidy) report.tidiedLines += 1;
      out.push(tidy ?? n);
    }
    return out;
  };

  const out: Node[] = [];
  segments.forEach((s, i) => {
    if (s.role === "solution") return; // emitted with its question
    const kind: SectionKind = SECTION_LABELS[s.kind] ? s.kind : "explanation";
    const body = bodyOf(s);
    const isQuestion = s.role === "question" && needsSolution(kind);
    if (!body.length && !isQuestion) return;
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    const repeatable = needsSolution(kind);
    const label = repeatable ? `${SECTION_LABELS[kind]} ${n}` : SECTION_LABELS[kind];
    const qid = isQuestion ? newId() : null;
    out.push({
      type: "heading",
      attrs: { level: 2, ...(qid ? { sectionId: qid } : {}) },
      content: [{ type: "text", text: label }],
    });
    out.push(...(body.length ? body : [{ type: "paragraph" }]));
    report.sessions += 1;
    if (!isQuestion || !qid) return;

    const solIdx = solutionFor.get(i);
    const solBody = solIdx != null ? bodyOf(segments[solIdx]) : [];
    if (solIdx != null && solIdx !== i + 1) report.movedSolutions += 1;
    out.push({
      type: "heading",
      attrs: { level: 3, ownerQuestionId: qid },
      content: [{ type: "text", text: `Solution ${n}` }],
    });
    if (solBody.length) out.push(...solBody);
    else {
      out.push({ type: "paragraph" });
      report.needsSolution.push({ label, questionId: qid });
    }
    report.sessions += 1;
    report.pairs += 1;
  });

  // Nothing is ever dropped: blocks the plan forgot stay at the end, in order.
  const leftovers = top.filter((n, idx) => !used.has(idx) && !isStructuralHeading(n) && plainText(n).trim() !== "" || (!used.has(idx) && n.type !== "paragraph" && n.type !== "heading"));
  if (leftovers.length) out.push(...leftovers);

  return { doc: { ...doc, type: doc.type || "doc", content: out.length ? out : [{ type: "paragraph" }] }, report };
}

/** Numbered, compact view of the note's top-level blocks for the classifier. */
export function describeBlocks(doc: { content?: Node[] }, textOf: (n: Node) => string): string[] {
  return (doc.content ?? []).map((n, i) => {
    const t = textOf(n).replace(/\s+/g, " ").trim().slice(0, 400);
    const tag = n.type === "heading" ? `heading` : n.type;
    return `[${i}] (${tag}) ${t || "(empty)"}`;
  });
}
