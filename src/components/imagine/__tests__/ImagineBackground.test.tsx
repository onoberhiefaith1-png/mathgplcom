import { describe, expect, it } from "vitest";
import { nextAuthoredBackgroundReady } from "../ImagineBackground";

describe("ImagineBackground", () => {
  it("keeps the default visible until an authored image loads", () => {
    expect(nextAuthoredBackgroundReady(false, "source-change")).toBe(false);
    expect(nextAuthoredBackgroundReady(false, "ready")).toBe(true);
  });

  it("returns to the default when authored media fails", () => {
    expect(nextAuthoredBackgroundReady(true, "error")).toBe(false);
  });

  it("hides the previous authored background when its source changes", () => {
    expect(nextAuthoredBackgroundReady(true, "source-change")).toBe(false);
  });
});