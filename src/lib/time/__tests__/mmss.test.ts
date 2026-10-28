import { describe, expect, it } from "vitest";
import { formatMmSs, parseMmSs } from "../mmss";

describe("MM:SS durations", () => {
  it("formats seconds as MM:SS", () => {
    expect(formatMmSs(0)).toBe("00:00");
    expect(formatMmSs(95)).toBe("01:35");
    expect(formatMmSs(3600)).toBe("60:00");
    expect(formatMmSs(undefined)).toBe("00:00");
  });

  it("parses MM:SS and bare seconds", () => {
    expect(parseMmSs("01:35")).toBe(95);
    expect(parseMmSs("1:5")).toBe(65);
    expect(parseMmSs("90")).toBe(90);
    expect(parseMmSs("2:70")).toBe(179);
  });

  it("treats empty and zero as no time", () => {
    expect(parseMmSs("")).toBeNull();
    expect(parseMmSs("00:00")).toBeNull();
    expect(parseMmSs("0")).toBeNull();
  });

  it("rejects nonsense without throwing", () => {
    expect(parseMmSs("abc")).toBeNull();
    expect(parseMmSs("1:2:3")).toBeNull();
  });
});
