// Turn one class Assessment row into SmartBoard content (beats + reservoirs)
// so a student solves it on the SAME board the teacher uses — scoped to just
// this assignment's question(s).
//
// SECURITY: the correct answer is NEVER reconstructed here. Reservoir lines
// carry only their grading `lineId` + `marks`; the `equation` field is left
// empty so the client cannot self-grade. Every line is checked by the
// server-side `grade-assessment` function, which holds the hidden key.

import type { Beat } from "@/lib/smartboard/presentation";
import type { Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";
import type { ContainerKind } from "@/lib/smartboard/floatingPlan";

export interface AssessmentQuestion {
  id: string;
  questionText: string;
  lines: { lineId: string; chips: string[]; marks: number; containers?: string[] }[];
}

export interface AssessmentLike {
  id: string;
  title: string;
  questions: AssessmentQuestion[];
}

export interface AssessmentBoardSource {
  beats: Beat[];
  reservoirs: Reservoir[];
  title: string;
}

/** Build SmartBoard beats + reservoirs from an assessment payload. */
export function buildAssessmentBoardSource(assessment: AssessmentLike): AssessmentBoardSource {
  const beats: Beat[] = [];
  const reservoirs: Reservoir[] = [];

  const questions = assessment.questions ?? [];
  questions.forEach((q, qi) => {
    const caption = questions.length > 1 ? `Question ${qi + 1}` : "Question";

    // One problem beat per question. `sectionKind: "example"` so the board
    // turns on the floating-number band + line-by-line composer, exactly like
    // the teacher solving an Example.
    beats.push({
      id: q.id,
      kind: "problem",
      caption,
      content: q.questionText ?? "",
      sectionKind: "example",
    });

    // Reservoir: floating numbers come from the shuffled chips (already the
    // only thing students were ever meant to see). Lines carry grading ids
    // only — no answer equations.
    const fragments: string[] = [];
    const lines: ReservoirLine[] = [];
    for (const ln of q.lines ?? []) {
      const start = fragments.length;
      const fills = (ln.chips ?? []).filter(Boolean);
      fragments.push(...fills);
      lines.push({
        equation: "", // withheld — graded server-side
        fillers: fills,
        containers: [],
        fragmentStart: start,
        fragmentEnd: fragments.length,
        lineId: ln.lineId,
        marks: Math.max(0, Number(ln.marks) || 0),
      });
    }

    reservoirs.push({ beatId: q.id, caption, fragments, lines });
  });

  return { beats, reservoirs, title: assessment.title ?? "Assignment" };
}
