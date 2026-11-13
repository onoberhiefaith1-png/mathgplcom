import { isMcqAnswerLabel, parseInlineMcq } from "@/lib/lessonnotes/inlineMcq";
import { sessionMarkerAt } from "@/lib/lessonnotes/sessionArrange";
import { docToLines, type McqIssue, type McqQuestion } from "./core";

/** Read-only extraction: worked examples remain in the source notebook. */
export function extractLessonMcqs(doc: unknown): { questions: McqQuestion[]; issues: McqIssue[]; skippedWorked: number } {
  const questions: McqQuestion[] = [], issues: McqIssue[] = [];
  let skippedWorked = 0;
  let block: { n: number; body: string[]; working: string[]; inSolution: boolean } | null = null;
  const finish = () => {
    if (!block) return;
    const answers = [...block.body, ...block.working].filter(isMcqAnswerLabel);
    const ownAnswer = block.body.findIndex(isMcqAnswerLabel);
    const body = ownAnswer < 0 ? block.body : block.body.slice(0, ownAnswer);
    const source = [...body, ...(answers.length === 1 ? answers : [])].join("\n");
    const optionLabels = [...body.join("\n").matchAll(/(?:^|\s)\(?([A-E])[.)](?:\s|$)/gi)];
    const mcq = answers.length === 1 ? parseInlineMcq(source) : null;
    if (mcq) questions.push({ n: questions.length + 1, ...mcq });
    else if (optionLabels.length >= 2 || (optionLabels.length > 0 && answers.length > 0)) {
      issues.push({ n: block.n, message: !answers.length ? "has no correct answer" : answers.length > 1
        ? "has more than one declared answer" : "has incomplete, repeated, or unmatched options; review the supplied answer" });
    } else skippedWorked++;
    block = null;
  };
  const lines = docToLines(doc);
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const marker = sessionMarkerAt(raw);
    const numbered = raw.trim().match(/^\(?(\d{1,3})[.)]\s+(\S.*)$/);
    const answerOffset = numbered ? lines.slice(index + 1).findIndex(isMcqAnswerLabel) : -1;
    const ahead = answerOffset < 0 ? [] : lines.slice(index + 1, index + 2 + answerOffset);
    const nextMcq = !!numbered && answerOffset >= 0 &&
      !ahead.some(line => /^\(?\d{1,3}[.)]\s+\S/.test(line.trim())) &&
      !!parseInlineMcq([numbered[2], ...ahead.filter(line => sessionMarkerAt(line)?.kind !== "solution")].join("\n"));
    if (marker?.kind === "question" || (numbered && (!block?.inSolution || nextMcq))) {
      finish();
      block = { n: marker?.n ?? Number(numbered![1]), body: [], working: [], inSolution: false };
      const text = marker?.rest ?? numbered![2];
      if (text) block.body.push(text);
    } else if (marker?.kind === "solution") {
      if (block) { block.inSolution = true; if (marker.rest) block.working.push(marker.rest); }
    } else if (isMcqAnswerLabel(raw)) {
      if (block) (block.inSolution ? block.working : block.body).push(raw);
    } else if (marker?.kind === "label" || marker?.kind === "group") {
      finish();
    } else if (block) (block.inSolution ? block.working : block.body).push(raw);
  }
  finish();
  return { questions, issues, skippedWorked };
}
