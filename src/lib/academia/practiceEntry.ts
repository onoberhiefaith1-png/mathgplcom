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
