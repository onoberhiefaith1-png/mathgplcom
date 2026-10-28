import { describe, expect, it } from "vitest";

import { describeListeningError, mapRecognitionError } from "../useListening";

describe("microphone failures the teacher can act on", () => {
  it("names a blocked microphone as a permission problem", () => {
    expect(mapRecognitionError("not-allowed")).toBe("blocked");
    expect(describeListeningError("blocked")).toMatch(/permission/i);
  });

  it("treats silence and a deliberate stop as normal, not a failure", () => {
    expect(mapRecognitionError("no-speech")).toBeNull();
    expect(mapRecognitionError("aborted")).toBeNull();
  });

  it("never blames a missing microphone for lost audio, and names an unavailable service", () => {
    expect(mapRecognitionError("audio-capture")).toBe("failed");
    expect(mapRecognitionError("service-not-allowed")).toBe("unavailable");
  });


  it("falls back to a plain retry message for anything unknown", () => {
    expect(mapRecognitionError("network")).toBe("failed");
    expect(describeListeningError("failed")).toMatch(/try again/i);
  });
});
