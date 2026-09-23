import { describe, expect, it } from "vitest";

import { readTranscriptEvents } from "../recognizeStream";

describe("reading the words back from a transcribed slice", () => {
  it("joins the deltas in the order they arrived", () => {
    const body = [
      'data: {"delta":"I went "}',
      'data: {"delta":"to school "}',
      'data: {"delta":"this morning"}',
      "data: [DONE]",
    ].join("\n");
    expect(readTranscriptEvents(body)).toBe("I went to school this morning");
  });

  it("accepts a slice delivered as one finished text", () => {
    expect(readTranscriptEvents('data: {"text":"and I took a cab"}')).toBe("and I took a cab");
  });

  it("ignores half-written lines instead of throwing", () => {
    const body = 'data: {"delta":"hello"}\ndata: {"delta":"  wor';
    expect(readTranscriptEvents(body)).toBe("hello");
  });

  it("is empty when nothing was said", () => {
    expect(readTranscriptEvents("data: [DONE]")).toBe("");
  });
});
