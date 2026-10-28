import { describe, it, expect } from "vitest";
import { resolveViewerQuestionId, initialViewerMode } from "../viewerFollow";

describe("resolveViewerQuestionId", () => {
  it("live mode: the broadcast question wins over the persisted row", () => {
    expect(
      resolveViewerQuestionId({
        mode: "live",
        liveQuestionId: "q3",
        lastPersistedQuestionId: "q1",
        firstQuestionId: "q1",
      }),
    ).toBe("q3");
  });

  it("live mode: uses the question the student reports through presence before the first frame", () => {
    expect(
      resolveViewerQuestionId({
        mode: "live",
        liveQuestionId: null,
        presenceQuestionId: "q1",
        lastPersistedQuestionId: "q3",
        firstQuestionId: "q1",
      }),
    ).toBe("q1");
  });

  it("live mode: never falls back to the last saved question", () => {
    expect(
      resolveViewerQuestionId({
        mode: "live",
        lastPersistedQuestionId: "q3",
        firstQuestionId: "q1",
      }),
    ).toBeNull();
  });

  it("work mode: ignores the live question and uses the teacher's pick", () => {
    expect(
      resolveViewerQuestionId({
        mode: "work",
        pickedQuestionId: "q4",
        liveQuestionId: "q3",
        lastPersistedQuestionId: "q1",
        firstQuestionId: "q1",
      }),
    ).toBe("q4");
  });

  it("work mode: honours ?q= before the persisted row", () => {
    expect(
      resolveViewerQuestionId({
        mode: "work",
        explicitQuestionId: "q5",
        liveQuestionId: "q3",
        lastPersistedQuestionId: "q1",
        firstQuestionId: "q1",
      }),
    ).toBe("q5");
  });
});

describe("initialViewerMode", () => {
  it("a deep link to one question opens in review mode", () => {
    expect(initialViewerMode({ explicitQuestionId: "q2", online: true })).toBe("work");
  });
  it("an online student is followed live", () => {
    expect(initialViewerMode({ online: true })).toBe("live");
  });
  it("an offline student opens in review mode", () => {
    expect(initialViewerMode({ online: false })).toBe("work");
  });
  it("an explicit mode request wins", () => {
    expect(initialViewerMode({ requestedMode: "live", explicitQuestionId: "q2" })).toBe("live");
  });
});
