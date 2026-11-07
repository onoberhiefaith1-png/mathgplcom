// Pure answer-key lookup used by grade-line. Kept dependency-free so the
// exact production lookup can be exercised from vitest.
export interface KeyLine {
  questionId: string;
  lineId: string;
  tokens: string[];
  equationAscii?: string;
}

/** The saved key line for (questionId, lineId): FIRST match, as always. */
export const findKeyLine = <T extends KeyLine>(keyLines: T[], questionId: string, lineId: string): T | undefined =>
  keyLines.find((k) => k.questionId === questionId && k.lineId === lineId);

/** The teacher's expected line: the equation, else the stored tokens. */
export const expectedAscii = (k: Pick<KeyLine, "tokens" | "equationAscii">): string =>
  String(k.equationAscii ?? "").trim() || (k.tokens ?? []).join(" ").trim();
