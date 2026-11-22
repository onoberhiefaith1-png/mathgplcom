/**
 * Academia Practice opens STRAIGHT onto the Smartboard with the question on it.
 * The phone/tablet question screen ("read it, then Open Smartboard") stays only
 * for ordinary class assignments.
 */
export const showsQuestionScreenFirst = (input: {
  mobile: boolean;
  boardOpen: boolean;
  academiaPractice: boolean;
}): boolean => input.mobile && !input.boardOpen && !input.academiaPractice;

/** A Practice card represents one question, including legacy assessments that
 * copied an entire section. If the source can't be verified, fail closed
 * instead of choosing a sibling or handing all of them to the board. */
export function questionForPracticeCard<T extends { id: string }>(questions: readonly T[], sourceId: string | null | undefined): T | undefined {
  return sourceId ? questions.find((question) => question.id === sourceId) :
    questions.length === 1 ? questions[0] : undefined;
}
