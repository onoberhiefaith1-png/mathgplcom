// Reasoning engine — the single source of truth for "which line is the
// student on, which board row is that line being written on, what belongs to
// this attempt, and what did the evaluation say".
//
// Everything else (Check button, silent auto-marking, the teacher Reasoning
// panel) only DISPLAYS what this engine decided. The engine is purely
// in-memory: nothing here is ever persisted, and it is cleared whenever the
// question, the board scope or the student changes.

export interface ReasoningAttempt {
  lineIdx: number;
  lineId: string | null;
  /** Board row this attempt is being written on (the Start Point binding). */
  rowNum: number | null;
  attempt: number;
  startedAt: number;
  /** Set at the End Point — the expression is immutable afterwards. */
  frozenAscii?: string;
  endedAt?: number;
  /** A newer attempt on the same line replaced this one; never gradable. */
  invalid?: boolean;
}

export interface ReasoningSnapshot {
  lineIdx: number;
  lineId: string | null;
  rowNum: number | null;
  attempt: number;
  studentAscii: string;
  floatingTokens: string[];
  introducedTerms: string[];
}

/** Atoms a human would call "terms": numbers and identifiers. */
export const atomize = (s: string): string[] =>
  (String(s ?? "").match(/[A-Za-z]+|\d+(?:\.\d+)?/g) ?? []).map((t) => t.toLowerCase());

/** Atoms the student wrote that the teacher never supplied for this line. */
export const introducedTerms = (studentAscii: string, floatingTokens: string[]): string[] => {
  const supplied = new Set(floatingTokens.flatMap(atomize));
  if (supplied.size === 0) return [];
  return Array.from(new Set(atomize(studentAscii).filter((a) => !supplied.has(a))));
};

export class ReasoningEngine {
  private attempts: ReasoningAttempt[] = [];
  private current: ReasoningAttempt | null = null;

  reset(): void {
    this.attempts = [];
    this.current = null;
  }

  get active(): ReasoningAttempt | null {
    return this.current;
  }

  /** START POINT — the student entered `lineIdx`. Re-entering the same line
   *  on the same row continues the attempt; entering it on a different row
   *  opens a NEW attempt and invalidates the previous one. */
  start(lineIdx: number, lineId: string | null, rowNum: number | null): ReasoningAttempt {
    const cur = this.current;
    if (cur && cur.lineIdx === lineIdx && !cur.endedAt) {
      if (rowNum === null || cur.rowNum === null || cur.rowNum === rowNum) {
        cur.lineId = lineId ?? cur.lineId;
        if (cur.rowNum === null) cur.rowNum = rowNum;
        return cur;
      }
    }
    const prior = this.attempts.filter((a) => a.lineIdx === lineIdx);
    for (const p of prior) p.invalid = true;
    const next: ReasoningAttempt = {
      lineIdx,
      lineId,
      rowNum,
      attempt: prior.length + 1,
      startedAt: Date.now(),
    };
    this.attempts.push(next);
    this.current = next;
    return next;
  }

  /** Keep the row binding in step with where the student is actually writing. */
  bindRow(lineIdx: number, rowNum: number): void {
    const cur = this.current;
    if (!cur || cur.lineIdx !== lineIdx || cur.endedAt) return;
    cur.rowNum = rowNum;
  }

  /** The row bound to a line — the only honest answer to "where is this line
   *  written?". `null` when the line was never visited. */
  rowFor(lineIdx: number): number | null {
    const live = this.attempts
      .filter((a) => a.lineIdx === lineIdx && !a.invalid)
      .slice(-1)[0];
    return live?.rowNum ?? null;
  }

  attemptFor(lineIdx: number): number {
    return this.attempts.filter((a) => a.lineIdx === lineIdx && !a.invalid).slice(-1)[0]?.attempt ?? 1;
  }

  /** END POINT — leaving the line, or pressing Check. Freezes the expression. */
  end(lineIdx: number, ascii: string): ReasoningAttempt | null {
    const target = this.attempts.filter((a) => a.lineIdx === lineIdx && !a.invalid).slice(-1)[0];
    if (!target) return null;
    if (target.frozenAscii === undefined) {
      target.frozenAscii = ascii;
      target.endedAt = Date.now();
    }
    if (this.current === target) this.current = null;
    return target;
  }

  frozenFor(lineIdx: number): string | undefined {
    return this.attempts.filter((a) => a.lineIdx === lineIdx && !a.invalid).slice(-1)[0]?.frozenAscii;
  }

  /** Re-opening an already frozen line for further work. */
  clearFreeze(lineIdx: number): void {
    for (const a of this.attempts) {
      if (a.lineIdx === lineIdx && !a.invalid) {
        a.frozenAscii = undefined;
        a.endedAt = undefined;
      }
    }
  }

  snapshot(lineIdx: number, lineId: string | null, studentAscii: string, floatingTokens: string[]): ReasoningSnapshot {
    return {
      lineIdx,
      lineId,
      rowNum: this.rowFor(lineIdx),
      attempt: this.attemptFor(lineIdx),
      studentAscii,
      floatingTokens,
      introducedTerms: introducedTerms(studentAscii, floatingTokens),
    };
  }
}
