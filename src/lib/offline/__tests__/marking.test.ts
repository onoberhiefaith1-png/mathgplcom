import { describe, expect, it } from "vitest";
import { markLine } from "../marking";

describe("offline Academia marking", () => {
  it("accepts the exact expected line", () => {
    expect(markLine("x = 8", "x=8")).toBe(true);
  });
  it("rejects a wrong answer", () => {
    expect(markLine("x = 8", "x = 9")).toBe(false);
  });
  it("rejects an empty line", () => {
    expect(markLine("x = 8", "")).toBe(false);
  });
});
