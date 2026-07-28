// Turn one class Assessment row into SmartBoard content (beats + reservoirs).

import type { Beat } from "@/lib/smartboard/presentation";
import type { Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";
import type { ContainerKind } from "@/lib/smartboard/floatingPlan";

export interface AssessmentQuestion {
  id: string;
  questionText: string;
  lines: { lineId: string; chips: string[]; marks: number; containers?: string[]; equation?: string }[];
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
      });
    }

    reservoirs.push({ beatId: q.id, caption, fragments, lines });
  });

  return { beats, reservoirs, title: assessment.title ?? "Assignment" };
}
