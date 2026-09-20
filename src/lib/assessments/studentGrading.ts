export function studentGradingKey(questionId: string, lineIndex: number, ascii: string): string {
  return `${questionId}:${lineIndex}:${ascii}`;
}

export function studentProgressSlot(questionId: string, lineId: string): string {
  return `${questionId}:${lineId}`;
}

export function totalSolvedMarks(solvedLines: Record<string, number>): number {
  return Object.values(solvedLines).reduce((sum, marks) => sum + (Number(marks) || 0), 0);
}

export function resultMatchesStudentLine(input: {
  expectedKey: string;
  questionId: string;
  lineIndex: number;
  ascii: string;
}): boolean {
  return input.expectedKey === studentGradingKey(input.questionId, input.lineIndex, input.ascii);
}

/** Keep proactive marking perceptually immediate while coalescing one burst of
 * taps/keystrokes into a single authoritative request. */
export const PROACTIVE_GRADING_DELAY_MS = 60;

/** A late automatic response may update the board only when it still belongs
 * to the exact question, line and expression currently being considered. */
export function isCurrentAutomaticGrade(input: {
  requestKey: string;
  questionId: string;
  lineIndex: number;
  ascii: string;
}): boolean {
  return resultMatchesStudentLine({
    expectedKey: input.requestKey,
    questionId: input.questionId,
    lineIndex: input.lineIndex,
    ascii: input.ascii,
  });
}