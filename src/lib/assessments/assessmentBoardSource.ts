// Turn one class Assessment row into SmartBoard content (beats + reservoirs).

import type { Beat } from "@/lib/smartboard/presentation";
import type { Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";
import type { ContainerKind } from "@/lib/smartboard/floatingPlan";
import type { FloatingTableRef } from "@/lib/lessonnotes/floatingCompile";

export interface AssessmentQuestion {
  id: string;
  questionText: string;
  lines: {
    lineId: string;
    chips: string[];
    marks: number;
    containers?: string[];
    equation?: string;
    /** Teaching note authored by this line's own highlight. */
    note?: string;
    /** Standalone note line (no equation of its own). */
    noteOnly?: boolean;
    /** Full table identity and grid snapshot; never flatten this into chips. */
    table?: FloatingTableRef;
  }[];
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

export function buildAssessmentBoardSource(assessment: AssessmentLike): AssessmentBoardSource {
  const beats: Beat[] = [];
  const reservoirs: Reservoir[] = [];

  const questions = assessment.questions ?? [];
  questions.forEach((q, qi) => {
    const caption = questions.length > 1 ? `Question ${qi + 1}` : "Question";

    beats.push({
      id: q.id,
      kind: "problem",
      caption,
      content: q.questionText ?? "",
      sectionKind: "example",
      sectionId: `question-${qi + 1}`,
      sectionLabel: caption,
    });

    const fragments: string[] = [];
    const lines: ReservoirLine[] = [];
    for (const ln of q.lines ?? []) {
      const start = fragments.length;
      const fills = (ln.chips ?? []).filter(Boolean);
      fragments.push(...fills);
      lines.push({
        equation: String(ln.equation ?? ""),
        fillers: fills,
        containers: (ln.containers ?? []) as ContainerKind[],
        fragmentStart: start,
        fragmentEnd: fragments.length,
        lineId: ln.lineId,
        marks: Math.max(0, Number(ln.marks) || 0),
        // The note travels with the line, so the board's existing note
        // machinery (icon, reveal, write-to-board, gate) works unchanged.
        notebook: ln.note && String(ln.note).trim() ? String(ln.note) : undefined,
        notebookOnly: ln.noteOnly === true,
        table: ln.table,
      });

    }

    reservoirs.push({ beatId: q.id, caption, fragments, lines });
  });

  return { beats, reservoirs, title: assessment.title ?? "Assignment" };
}
