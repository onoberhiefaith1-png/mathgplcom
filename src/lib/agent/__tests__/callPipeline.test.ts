import { describe, expect, it } from "vitest";

import { takeClauses } from "../speechQueue";
import { VoiceSession, VOICE_TUNING } from "../voiceSession";

/** Replays a trace of microphone readings, 60ms apart, like the real loop. */
function play(
  session: VoiceSession,
  trace: { level: number; transcript?: string; selfLevel?: number; finalPending?: boolean; ms: number }[],
  from = 0,
) {
  let now = from;
  const effects: string[] = [];
  for (const span of trace) {
    for (let elapsed = 0; elapsed < span.ms; elapsed += 60) {
      now += 60;
      for (const effect of session.feed({
        now,
        level: span.level,
        transcript: span.transcript ?? "",
        ...(span.selfLevel === undefined ? {} : { selfLevel: span.selfLevel }),
        ...(span.finalPending === undefined ? {} : { finalPending: span.finalPending }),
      })) {
        effects.push(effect.kind === "turn" ? `turn:${effect.text}` : "cut");
      }
    }
  }
  return { effects, now };
}

describe("a turn closes when the sentence is really finished", () => {
  it("waits for the last words instead of cutting the sentence short", () => {
    const session = new VoiceSession();
    session.begin(0);
    const early = play(session, [
      { level: 0.3, transcript: "let's go", ms: 600 },
      // Quiet, but the engine has not delivered the finished words yet.
      { level: 0.01, transcript: "let's go", finalPending: true, ms: 1200 },
    ]);
    expect(early.effects).toEqual([]);

    // The finished words land, and only then does the turn close — whole.
    const late = play(
      session,
      [{ level: 0.01, transcript: "let's go come home", finalPending: false, ms: 300 }],
      early.now,
    );
    expect(late.effects).toEqual(["turn:let's go come home"]);
  });

  it("closes anyway if the engine never delivers, using everything heard", () => {
    const session = new VoiceSession();
    session.begin(0);
    const { effects } = play(session, [
      { level: 0.3, transcript: "seven times eight", ms: 600 },
      { level: 0.01, transcript: "seven times eight", finalPending: true, ms: 2400 },
    ]);
    expect(effects).toEqual(["turn:seven times eight"]);
  });
});

describe("a noisy room and her own voice", () => {
  it("still hears the end of a sentence in a room with background noise", () => {
    const session = new VoiceSession();
    session.begin(0);
    // Two seconds of steady classroom hum teaches her the room, then speech.
    const { effects } = play(session, [
      { level: 0.05, ms: 2000 },
      { level: 0.4, transcript: "open the lesson", ms: 700 },
      { level: 0.05, transcript: "open the lesson", ms: 1200 },
    ]);
    expect(effects).toEqual(["turn:open the lesson"]);
  });

  it("never lets her own voice interrupt her, but a real voice does", () => {
    const session = new VoiceSession();
    session.begin(0);
    session.replyStarted();
    // Her own speech coming back through the loudspeaker.
    const own = play(session, [{ level: 0.45, selfLevel: 0.5, ms: 1200 }]);
    expect(own.effects).toEqual([]);
    expect(session.state).toBe("speaking");

    // Someone talking clearly over her.
    const over = play(session, [{ level: 0.85, selfLevel: 0.5, ms: 600 }], own.now);
    expect(over.effects).toEqual(["cut"]);
    expect(session.state).toBe("interrupted");
  });
});

describe("her reply is cut where a person would breathe", () => {
  it("speaks the first clause before the sentence has finished", () => {
    const first = takeClauses("Let me open that lesson for you, and then we can");
    expect(first.clauses).toEqual(["Let me open that lesson for you,"]);
    expect(first.rest.trim()).toBe("and then we can");
  });

  it("never speaks a scrap of a word on its own", () => {
    const { clauses, rest } = takeClauses("Right, I'm on it");
    expect(clauses).toEqual([]);
    expect(rest).toBe("Right, I'm on it");
  });

  it("keeps decimals and short fragments together", () => {
    const { clauses, rest } = takeClauses("The answer is 3.5 so we halve it, then add two. ");
    // The decimal point is not a boundary; the short tail waits for more words.
    expect(clauses).toEqual(["The answer is 3.5 so we halve it,"]);
    expect(rest.trim()).toBe("then add two.");
  });

  it("gives up the last fragment only when the reply has finished", () => {
    const open = takeClauses("Almost there");
    expect(open.clauses).toEqual([]);
    const closed = takeClauses(open.rest, true);
    expect(closed.clauses).toEqual(["Almost there"]);
  });
});

describe("tuning stays honest", () => {
  it("keeps the thresholds it documents", () => {
    expect(VOICE_TUNING.endOfTurnMs).toBeLessThanOrEqual(900);
    expect(VOICE_TUNING.maxTurnMs).toBeGreaterThan(VOICE_TUNING.finalWaitMs);
  });
});
