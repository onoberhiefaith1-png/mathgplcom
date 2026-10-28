import { describe, expect, it } from "vitest";

import {
  VoiceSession,
  VOICE_TUNING,
  describeVoiceState,
  takeSentences,
  type VoiceEffect,
} from "../voiceSession";

/** Replay a trace of readings, 50ms apart, and collect what happened. */
function play(
  session: VoiceSession,
  steps: { level: number; transcript?: string; ms?: number }[],
  startAt = 0,
) {
  let now = startAt;
  const effects: VoiceEffect[] = [];
  for (const step of steps) {
    now += step.ms ?? 50;
    effects.push(...session.feed({ now, level: step.level, transcript: step.transcript ?? "" }));
  }
  return { effects, now };
}

const loud = (count: number, transcript = "solve two x plus five") =>
  Array.from({ length: count }, () => ({ level: 0.4, transcript }));
const quiet = (count: number, transcript = "solve two x plus five") =>
  Array.from({ length: count }, () => ({ level: 0.01, transcript }));

describe("voice session", () => {
  it("does nothing until the session is opened", () => {
    const session = new VoiceSession();
    const { effects } = play(session, [...loud(10), ...quiet(40)]);
    expect(effects).toEqual([]);
    expect(session.state).toBe("idle");
  });

  it("closes the turn after a real pause and sends the words", () => {
    const session = new VoiceSession();
    session.begin();
    const { effects } = play(session, [...loud(12), ...quiet(30)]);
    expect(effects).toEqual([{ kind: "turn", text: "solve two x plus five" }]);
    expect(session.state).toBe("thinking");
  });

  it("keeps listening through a mid-sentence breath", () => {
    const session = new VoiceSession();
    session.begin();
    // Speech, a short breath well under the end-of-turn pause, then more speech.
    const { effects } = play(session, [...loud(10), ...quiet(8), ...loud(10)]);
    expect(effects).toEqual([]);
    expect(session.state).toBe("listening");
  });

  it("never closes a turn on silence alone", () => {
    const session = new VoiceSession();
    session.begin();
    const { effects } = play(session, quiet(60, ""));
    expect(effects).toEqual([]);
    expect(session.state).toBe("listening");
  });

  it("will not send a turn that heard no words", () => {
    const session = new VoiceSession();
    session.begin();
    const { effects } = play(session, [...loud(12, ""), ...quiet(30, "")]);
    expect(effects).toEqual([]);
  });

  it("ignores a knock while she is speaking", () => {
    const session = new VoiceSession();
    session.begin();
    session.replyStarted();
    // One very short loud burst, shorter than the barge-in window.
    const { effects } = play(session, [{ level: 0.9 }, { level: 0.01 }, { level: 0.01 }]);
    expect(effects).toEqual([]);
    expect(session.state).toBe("speaking");
  });

  it("cuts her off when the teacher talks over her", () => {
    const session = new VoiceSession();
    session.begin();
    session.replyStarted();
    const { effects } = play(session, Array.from({ length: 8 }, () => ({ level: 0.5 })));
    expect(effects).toEqual([{ kind: "cut" }]);
    // Her voice is cut and she is back to hearing them, not speaking.
    expect(session.state).not.toBe("speaking");
    expect(session.attentive || session.state === "interrupted").toBe(true);
  });

  it("treats the interruption as the start of the next turn", () => {
    const session = new VoiceSession();
    session.begin();
    session.replyStarted();
    const { now } = play(session, Array.from({ length: 8 }, () => ({ level: 0.5 })));
    const { effects } = play(
      session,
      [...loud(10, "I meant the other part"), ...quiet(30, "I meant the other part")],
      now,
    );
    expect(effects).toEqual([{ kind: "turn", text: "I meant the other part" }]);
  });

  it("waits attentively after she finishes and accepts the next turn", () => {
    const session = new VoiceSession();
    session.begin();
    session.replyStarted();
    session.replyEnded();
    expect(session.state).toBe("waiting");
    expect(session.attentive).toBe(true);
    const { effects } = play(session, [...loud(12, "now the next one"), ...quiet(30, "now the next one")]);
    expect(effects).toEqual([{ kind: "turn", text: "now the next one" }]);
  });

  it("stops completely when the session ends", () => {
    const session = new VoiceSession();
    session.begin();
    session.end();
    const { effects } = play(session, [...loud(12), ...quiet(40)]);
    expect(effects).toEqual([]);
    expect(session.state).toBe("idle");
    expect(session.attentive).toBe(false);
  });

  it("needs sustained speech, not a single blip, to make a turn", () => {
    const session = new VoiceSession();
    session.begin();
    // One 50ms blip is under the minimum speech for a turn.
    const { effects } = play(session, [{ level: 0.4, transcript: "hm" }, ...quiet(40, "hm")]);
    expect(effects).toEqual([]);
  });

  it("has plain words for every state", () => {
    for (const state of ["idle", "listening", "thinking", "speaking", "interrupted", "waiting"] as const) {
      expect(describeVoiceState(state).length).toBeGreaterThan(3);
    }
  });

  it("tunes barge-in above ordinary speech, so her own voice is not a turn", () => {
    expect(VOICE_TUNING.bargeLevel).toBeGreaterThan(VOICE_TUNING.speechLevel);
    expect(VOICE_TUNING.silenceLevel).toBeLessThan(VOICE_TUNING.speechLevel);
  });
});

describe("speaking a reply sentence by sentence", () => {
  it("hands over whole sentences and keeps the tail back", () => {
    const { sentences, rest } = takeSentences("Right, so we subtract five. Then we divide by two. And th");
    expect(sentences).toEqual(["Right, so we subtract five.", "Then we divide by two."]);
    expect(rest).toBe("And th");
  });

  it("keeps an unfinished sentence until it ends", () => {
    expect(takeSentences("Let me look at").sentences).toEqual([]);
    expect(takeSentences("Let me look at").rest).toBe("Let me look at");
  });

  it("handles questions and exclamations", () => {
    expect(takeSentences("Ready? Good!").sentences).toEqual(["Ready?", "Good!"]);
  });
});
