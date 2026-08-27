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

  it("live mode: falls back to the last persisted question when the student is offline", () => {
    expect(
      resolveViewerQuestionId({
        mode: "live",
        liveQuestionId: null,
        lastPersistedQuestionId: "q2",
        firstQuestionId: "q1",
      }),
    ).toBe("q2");
  });

  it("live mode: never lands on nothing", () => {
    expect(resolveViewerQuestionId({ mode: "live", firstQuestionId: "q1" })).toBe("q1");
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
