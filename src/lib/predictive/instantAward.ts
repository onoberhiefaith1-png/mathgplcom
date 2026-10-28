// INSTANT AWARD — one shared shape for "the Predictive Line Engine proved this
// line complete, so its mark is awarded now".
//
// This module owns no mathematics. The proof comes from the single shared
// Predictive Line Engine; this only turns that proof into the exact award
// payload the board broadcasts and the Game consumes, so both surfaces see
// identical events and nothing has to guess.

export interface InstantAwardInput {
  questionId: string;
  lineId: string;
  marks: number;
  /** The exact working that earned the mark. */
  ascii: string;
}

export interface InstantAward {
  questionId: string;
  lineId: string;
  mode: "auto";
  correct: true;
  verdict: "equal";
  diagnosis: { code: "predictive_equal"; label: string; detail: string };
  marks: number;
  studentAscii: string;
}

export const buildInstantAward = (input: InstantAwardInput): InstantAward => ({
  questionId: input.questionId,
  lineId: input.lineId,
  mode: "auto",
  correct: true,
  verdict: "equal",
  diagnosis: {
    code: "predictive_equal",
    label: "Equivalent",
    detail: "This line is complete and equivalent to the expected step.",
  },
  marks: Number(input.marks) || 0,
  studentAscii: input.ascii,
});

/** The exact working proof the Game's award gate compares against. */
export const awardProofExpression = (ascii: string): string => ascii.trim();
