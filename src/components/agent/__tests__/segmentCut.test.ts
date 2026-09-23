import { describe, expect, it } from "vitest";

import {
  MAX_SEGMENT_MS,
  MIN_SEGMENT_MS,
  SILENCE_HOLD_MS,
  segmentPrompt,
  shouldCloseSegment,
  VOCABULARY,
} from "../recognizeStream";

describe("where a recording is cut", () => {
  it("keeps recording while the teacher is still speaking", () => {
    expect(
      shouldCloseSegment({ elapsedMs: 4000, quietMs: 0, heardSpeech: true }),
    ).toBe(false);
  });

  it("keeps recording through a short breath mid-sentence", () => {
    expect(
      shouldCloseSegment({ elapsedMs: 4000, quietMs: SILENCE_HOLD_MS - 200, heardSpeech: true }),
    ).toBe(false);
  });

  it("closes once the pause is long enough", () => {
    expect(
      shouldCloseSegment({ elapsedMs: 4000, quietMs: SILENCE_HOLD_MS, heardSpeech: true }),
    ).toBe(true);
  });

  it("never cuts a barely-started recording, so no word is halved", () => {
    expect(
      shouldCloseSegment({ elapsedMs: MIN_SEGMENT_MS - 100, quietMs: 2000, heardSpeech: true }),
    ).toBe(false);
  });

  it("waits indefinitely when nothing has been said yet", () => {
    expect(
      shouldCloseSegment({ elapsedMs: 8000, quietMs: 8000, heardSpeech: false }),
    ).toBe(false);
  });

  it("closes on the ceiling so words still arrive during a long answer", () => {
    expect(
      shouldCloseSegment({ elapsedMs: MAX_SEGMENT_MS, quietMs: 0, heardSpeech: true }),
    ).toBe(true);
  });
});

describe("the hint sent with each recording", () => {
  it("always carries Aura's vocabulary", () => {
    expect(segmentPrompt("")).toBe(VOCABULARY);
  });

  it("adds what was said so far, so the next piece is read in context", () => {
    expect(segmentPrompt("the text to speech is")).toContain("Continuing: the text to speech is");
  });

  it("keeps only the recent words", () => {
    const said = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ");
    const prompt = segmentPrompt(said);
    expect(prompt).not.toContain("word5 ");
    expect(prompt).toContain("word59");
  });
});
