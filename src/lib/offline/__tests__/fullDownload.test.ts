import { describe, expect, it } from "vitest";
import { downloadPercent } from "../fullDownload";

describe("offline download progress", () => {
  it("reaches 100 only when finished", () => {
    expect(downloadPercent("media", 10, 10)).toBeLessThan(100);
    expect(downloadPercent("done")).toBe(100);
  });
  it("grows with saved media", () => {
    expect(downloadPercent("media", 1, 4)).toBeLessThan(downloadPercent("media", 3, 4));
  });
});
