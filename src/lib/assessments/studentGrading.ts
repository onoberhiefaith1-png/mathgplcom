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