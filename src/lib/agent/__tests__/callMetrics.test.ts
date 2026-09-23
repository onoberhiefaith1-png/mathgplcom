import { describe, expect, it } from "vitest";

import { CallMetrics, describeCallTiming } from "../callMetrics";
import { takeClauses } from "../speechQueue";
import { VoiceSession, isAcknowledgement, VOICE_TUNING, type VoiceEffect } from "../voiceSession";

describe("measuring a call turn", () => {
  it("reports the real gaps from the end of their speech", () => {
    const metrics = new CallMetrics();
    metrics.mark("turnClosed", 1000);
    metrics.mark("firstToken", 1400);
    metrics.mark("firstAudio", 1750);
    metrics.mark("speechEnd", 4000);
    expect(metrics.summary()).toMatchObject({
      turns: 1,
      toFirstToken: 400,
      toFirstAudio: 750,
      toSpeechEnd: 3000,
    });
  });

  it("counts only the first sound of a reply, not later clauses", () => {
    const metrics = new CallMetrics();
    metrics.mark("turnClosed", 0);
    metrics.mark("firstAudio", 800);
    metrics.mark("firstAudio", 1600);
    expect(metrics.summary().toFirstAudio).toBe(800);
  });

  it("keeps the worst delay of the call, never rounded away", () => {
    const metrics = new CallMetrics();
    metrics.mark("turnClosed", 0);
    metrics.mark("firstAudio", 2600);
    metrics.mark("turnClosed", 5000);
    metrics.mark("firstAudio", 5700);
    const summary = metrics.summary();
    expect(summary.toFirstAudio).toBe(700);
    expect(summary.worstFirstAudio).toBe(2600);
  });

  it("says nothing until something has been measured", () => {
    expect(describeCallTiming(new CallMetrics().summary())).toBeNull();
  });
});

describe("cutting her reply for speaking", () => {
  it("starts speaking on the opener alone", () => {
    const { clauses } = takeClauses("So, we subtract five from both sides", { first: true });
    expect(clauses[0]).toBe("So");
  });

  it("cuts the first clause very short, later clauses longer", () => {
    expect(takeClauses("Right — let's look at it", { first: true }).clauses[0]).toBe("Right");
    // Without first mode, a short fragment is held back until it is worth saying.
    expect(takeClauses("Right, ok", {}).clauses).toEqual([]);
  });

  it("still keeps an unfinished clause back", () => {
    const { clauses, rest } = takeClauses("So, we subtract five and then we", { first: true });
    expect(clauses).toContain("So");
    expect(rest.endsWith("we")).toBe(true);
  });

  it("gives up the remainder when the reply has finished arriving", () => {
    expect(takeClauses("that's it", true).clauses).toEqual(["that's it"]);
  });
});

function play(session: VoiceSession, steps: { level: number; transcript?: string }[], startAt = 0) {
  let now = startAt;
  const effects: VoiceEffect[] = [];
  for (const step of steps) {
    now += 50;
    effects.push(...session.feed({ now, level: step.level, transcript: step.transcript ?? "" }));
  }
  return { effects, now };
}

describe("turn-taking as a conversation", () => {
  it("cancels the turn if they start again inside the grace window", () => {
    const session = new VoiceSession();
    session.begin();
    // Speech, a pause just long enough to be ready, then speech again.
    const { effects } = play(session, [
      ...Array.from({ length: 12 }, () => ({ level: 0.4, transcript: "let's go" })),
      ...Array.from({ length: 19 }, () => ({ level: 0.01, transcript: "let's go" })),
      ...Array.from({ length: 10 }, () => ({ level: 0.4, transcript: "let's go home" })),
    ]);
    expect(effects).toEqual([]);
    expect(session.state).toBe("listening");
  });

  it("shortens the pause as it learns their rhythm", () => {
    const session = new VoiceSession();
    session.begin();
    const before = session.endOfTurnPause;
    play(session, [
      ...Array.from({ length: 12 }, () => ({ level: 0.4, transcript: "one" })),
      ...Array.from({ length: 30 }, () => ({ level: 0.01, transcript: "one" })),
    ]);
    expect(session.endOfTurnPause).toBeLessThan(before);
    expect(session.endOfTurnPause).toBeGreaterThanOrEqual(VOICE_TUNING.minEndOfTurnMs);
  });

  it("treats a short 'mm-hm' after her reply as agreement, not a question", () => {
    const session = new VoiceSession();
    session.begin();
    session.replyStarted();
    session.replyEnded();
    const { effects } = play(session, [
      ...Array.from({ length: 12 }, () => ({ level: 0.4, transcript: "okay" })),
      ...Array.from({ length: 30 }, () => ({ level: 0.01, transcript: "okay" })),
    ]);
    expect(effects).toEqual([]);
    expect(session.state).toBe("waiting");
  });

  it("knows an acknowledgement from a real sentence", () => {
    expect(isAcknowledgement("mm-hm")).toBe(true);
    expect(isAcknowledgement("Okay.")).toBe(true);
    expect(isAcknowledgement("okay so what about the next one")).toBe(false);
  });
});
