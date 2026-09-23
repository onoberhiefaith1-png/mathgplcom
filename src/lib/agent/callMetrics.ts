// What a call actually costs in time, measured rather than felt.
//
// Four stamps per turn: the moment the teacher's words are closed off, her first
// written word, her first audible sound, and the moment her voice stops. Nothing
// here changes behaviour — it only records, so a slow call can be reported with
// real numbers instead of an impression.

export type CallStage = "turnClosed" | "firstToken" | "firstAudio" | "speechEnd";

export type TurnTiming = {
  turnClosed: number;
  firstToken?: number;
  firstAudio?: number;
  speechEnd?: number;
};

export type CallSummary = {
  turns: number;
  /** Milliseconds from the end of their speech to her first written word. */
  toFirstToken: number | null;
  /** Milliseconds from the end of their speech to her first audible sound. */
  toFirstAudio: number | null;
  /** The worst first-sound delay of the call — never rounded away. */
  worstFirstAudio: number | null;
  /** Milliseconds from the end of their speech to her voice finishing. */
  toSpeechEnd: number | null;
};

const MAX_TURNS = 40;

export class CallMetrics {
  private turns: TurnTiming[] = [];

  /** A new turn begins: their words have just been closed off. */
  mark(stage: CallStage, at: number): void {
    if (stage === "turnClosed") {
      this.turns.push({ turnClosed: at });
      if (this.turns.length > MAX_TURNS) this.turns.shift();
      return;
    }
    const turn = this.turns[this.turns.length - 1];
    if (!turn) return;
    // Only the first of each kind counts; later clauses are not "the first sound".
    if (turn[stage] === undefined) turn[stage] = at;
  }

  get latest(): TurnTiming | null {
    return this.turns[this.turns.length - 1] ?? null;
  }

  /** The numbers as they are, for the read-out and for reporting. */
  summary(): CallSummary {
    const gap = (turn: TurnTiming, stage: Exclude<CallStage, "turnClosed">) =>
      turn[stage] === undefined ? null : Math.round(turn[stage]! - turn.turnClosed);
    const last = this.latest;
    const worst = this.turns
      .map((turn) => gap(turn, "firstAudio"))
      .filter((value): value is number => value !== null);
    return {
      turns: this.turns.length,
      toFirstToken: last ? gap(last, "firstToken") : null,
      toFirstAudio: last ? gap(last, "firstAudio") : null,
      worstFirstAudio: worst.length ? Math.max(...worst) : null,
      toSpeechEnd: last ? gap(last, "speechEnd") : null,
    };
  }

  reset(): void {
    this.turns = [];
  }
}

/** The read-out beside the call strip: plain, short, and honest. */
export function describeCallTiming(summary: CallSummary): string | null {
  if (summary.toFirstAudio === null && summary.toFirstToken === null) return null;
  const parts: string[] = [];
  if (summary.toFirstToken !== null) parts.push(`words ${summary.toFirstToken}ms`);
  if (summary.toFirstAudio !== null) parts.push(`voice ${summary.toFirstAudio}ms`);
  if (summary.worstFirstAudio !== null && summary.worstFirstAudio !== summary.toFirstAudio) {
    parts.push(`worst ${summary.worstFirstAudio}ms`);
  }
  return parts.join(" · ");
}
