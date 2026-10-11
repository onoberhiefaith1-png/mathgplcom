import { describe, expect, it } from "vitest";
import { isFreshCommand, pathForOpen, smartboardSteps } from "../liveCommand";

const id = "123e4567-e89b-12d3-a456-426614174000";

describe("ChatGPT live command rules", () => {
  it("opens a notebook on the Smartboard only with a real notebook id", () => {
    expect(pathForOpen("smartboard", id)).toBe(`/smartboard/${id}`);
    expect(pathForOpen("smartboard", "../admin")).toBe("/smartboard");
    expect(pathForOpen("note", undefined)).toBe("/lesson-notes");
  });
  it("sends unknown targets home", () => {
    expect(pathForOpen("https://evil.example")).toBe("/");
  });
  it("discards commands older than one minute", () => {
    const now = Date.parse("2026-10-11T12:00:00Z");
    expect(isFreshCommand("2026-10-11T11:59:30Z", now)).toBe(true);
    expect(isFreshCommand("2026-10-11T11:58:59Z", now)).toBe(false);
    expect(isFreshCommand("not a date", now)).toBe(false);
  });
  it("clamps Smartboard steps to 1-20", () => {
    expect(smartboardSteps(50)).toBe(20);
    expect(smartboardSteps(0)).toBe(1);
    expect(smartboardSteps("x")).toBe(1);
    expect(smartboardSteps(3)).toBe(3);
  });
});
