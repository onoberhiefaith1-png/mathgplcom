import { parseInlineMcq, type InlineMcq } from "@/lib/lessonnotes/inlineMcq";
import type { FloatingLine } from "@/lib/lessonnotes/floatingCompile";

/** One answer slot, using the existing deterministic grading contract. */
export function inlineMcqLine(q: InlineMcq, questionId: string): FloatingLine {
  return { lineId: `${questionId}-choice`, equation: q.answer,
    fillers: q.options.map(o => o.label), containers: [],
    arrangement: q.options.map((_, i) => i), marks: 1 };
}
export function compileInlineMcq(source: string, questionId: string) {
  const mcq = parseInlineMcq(source);
  if (!mcq) return null;
  const line = inlineMcqLine(mcq, questionId);
  return {
    question: { id: questionId, questionText: mcq.text, mcq,
      lines: [{ lineId: line.lineId, chips: line.fillers, containers: [], marks: 1 }] },
    answerKey: { questionId, lineId: line.lineId, tokens: [mcq.answer], equationAscii: mcq.answer },
    total: 1,
  };
}
