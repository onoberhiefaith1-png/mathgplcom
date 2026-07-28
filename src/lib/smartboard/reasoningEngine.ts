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
  /** Navigation-only visit. NOT an attempt until the student writes. */
  private pending: { lineIdx: number; lineId: string | null; rowNum: number | null } | null = null;

  reset(): void {
    this.attempts = [];
    this.current = null;
    this.pending = null;
  }

  get active(): ReasoningAttempt | null {
    return this.current;
  }

  /** NAVIGATION — the student moved the Floating Number Display onto
   *  `lineIdx`. This creates NO attempt and changes no counters. Moving
   *  2 → 4 → 6 → 3 without writing leaves the attempt count untouched. */
  enter(lineIdx: number, lineId: string | null, rowNum: number | null): void {
    const cur = this.current;
    if (cur && cur.lineIdx === lineIdx && !cur.endedAt) {
      // Returning to the line we are already attempting: keep the attempt.
      cur.lineId = lineId ?? cur.lineId;
      if (rowNum !== null) cur.rowNum = rowNum;
      this.pending = null;
      return;
    }
    this.pending = { lineIdx, lineId, rowNum };
  }

  /** FIRST WRITE — the student actually produced content on `lineIdx`
   *  (chip tap, keyboard, inserted object, Add tool). Only now does an
   *  attempt exist. Idempotent while that attempt is alive. */
  write(lineIdx: number, lineId?: string | null, rowNum?: number | null): ReasoningAttempt {
    const cur = this.current;
    if (cur && cur.lineIdx === lineIdx && !cur.endedAt) {
      if (rowNum != null) cur.rowNum = rowNum;
      return cur;
    }
    const p = this.pending && this.pending.lineIdx === lineIdx ? this.pending : null;
    const prior = this.attempts.filter((a) => a.lineIdx === lineIdx);
    for (const q of prior) q.invalid = true;
    const next: ReasoningAttempt = {
      lineIdx,
      lineId: lineId ?? p?.lineId ?? null,
      rowNum: rowNum ?? p?.rowNum ?? null,
      attempt: prior.length + 1,
      startedAt: Date.now(),
    };
    this.attempts.push(next);
    this.current = next;
    this.pending = null;
    return next;
  }

  /** START POINT — legacy entry point: navigate AND begin writing at once. */
  start(lineIdx: number, lineId: string | null, rowNum: number | null): ReasoningAttempt {
    const cur = this.current;
    if (cur && cur.lineIdx === lineIdx && !cur.endedAt) {
      if (rowNum === null || cur.rowNum === null || cur.rowNum === rowNum) {
        cur.lineId = lineId ?? cur.lineId;
        if (cur.rowNum === null) cur.rowNum = rowNum;
        return cur;
      }
    }
    this.enter(lineIdx, lineId, rowNum);
    return this.write(lineIdx, lineId, rowNum);
  }

  /** CANCELLED ATTEMPT — everything written on `lineIdx` was deleted before
   *  the student left. That attempt never existed: no history, no freeze,
   *  no evaluation. The count returns to what it was before. */
  cancel(lineIdx: number): void {
    const live = this.attempts.filter((a) => a.lineIdx === lineIdx && !a.invalid).slice(-1)[0];
    if (!live) return;
    this.attempts = this.attempts.filter((a) => a !== live);
    // The attempt it superseded (if any) becomes live again.
    const prior = this.attempts.filter((a) => a.lineIdx === lineIdx);
    const restored = prior[prior.length - 1];
    if (restored) restored.invalid = false;
    if (this.current === live) this.current = null;
    this.pending = null;
  }

  /** The most recent attempt that is still unfinished (started, never
   *  cancelled, not frozen) on a line OTHER than `exceptLine`. Ownership of
   *  the editing session returns here when a temporary attempt is cancelled. */
  lastUnfinishedLine(exceptLine?: number): number | null {
    for (let i = this.attempts.length - 1; i >= 0; i--) {
      const a = this.attempts[i];
      if (a.invalid) continue;
      if (exceptLine !== undefined && a.lineIdx === exceptLine) continue;
      return a.lineIdx;
    }
    return null;
  }

  /** True when the line has a real (written) attempt. */
  hasAttempt(lineIdx: number): boolean {
    return this.attempts.some((a) => a.lineIdx === lineIdx && !a.invalid);
  }

  /** Keep the row binding in step with where the student is actually writing. */
  bindRow(lineIdx: number, rowNum: number): void {
    const cur = this.current;
    if (!cur || cur.lineIdx !== lineIdx || cur.endedAt) {
      if (this.pending && this.pending.lineIdx === lineIdx) this.pending.rowNum = rowNum;
      return;
    }
    cur.rowNum = rowNum;
  }


  /** The row bound to a line — the only honest answer to "where is this line
   *  written?". `null` when the line was never visited. A navigation-only
   *  visit still reports its row so the live panel can follow the student. */
  rowFor(lineIdx: number): number | null {
    const live = this.attempts
      .filter((a) => a.lineIdx === lineIdx && !a.invalid)
      .slice(-1)[0];
    if (live) return live.rowNum ?? null;
    if (this.pending && this.pending.lineIdx === lineIdx) return this.pending.rowNum ?? null;
    return null;
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
