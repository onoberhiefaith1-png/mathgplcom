import { describe, expect, it } from "vitest";
import { PUBLIC_SITE, joinUrl } from "./publicUrl";

describe("joinUrl", () => {
  it("builds a public join link from a code", () => {
    expect(joinUrl("cs6ycu")).toBe(`${PUBLIC_SITE}/live/join/CS6YCU`);
  });
  it("trims whitespace", () => {
    expect(joinUrl("  ab12 ")).toBe(`${PUBLIC_SITE}/live/join/AB12`);
  });
});
