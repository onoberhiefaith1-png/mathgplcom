/**
 * Student questions that belong to an assessment card — not to the general
 * notification system. One question is attached to the assessment (the
 * assignment card) plus the exact lesson-note question the student was on.
 */
export type AssessmentStudentQuestion = {
  id: string;
  assessmentId: string;
  classId: string;
  studentUserId: string;
  studentName?: string;
  boardQuestionId: string | null;
  body: string;
  answerBody: string | null;
  answeredAt: string | null;
  createdAt: string;
};

/** Unanswered first, then newest first inside each group. */
export const sortForTeacher = (list: AssessmentStudentQuestion[]): AssessmentStudentQuestion[] =>
  [...list].sort((a, b) => {
    const aOpen = a.answerBody ? 1 : 0;
    const bOpen = b.answerBody ? 1 : 0;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return b.createdAt.localeCompare(a.createdAt);
  });

export const unansweredCount = (list: AssessmentStudentQuestion[]): number =>
  list.filter((q) => !q.answerBody).length;

/**
 * The student's own thread for the board they are looking at. When a board
 * question is active only that question's messages are shown, so the teacher's
 * answer appears exactly where the student asked it.
 */
export const questionsForBoard = (
  list: AssessmentStudentQuestion[],
  boardQuestionId: string | null | undefined,
): AssessmentStudentQuestion[] => {
  const scoped = boardQuestionId
    ? list.filter((q) => q.boardQuestionId === boardQuestionId || q.boardQuestionId === null)
    : list;
  return [...scoped].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};
