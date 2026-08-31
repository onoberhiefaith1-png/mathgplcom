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

describe("referralUrl", () => {
  it("always points at the public MathGPL address with the token behind it", () => {
    expect(referralUrl("ab12cd")).toBe(`${PUBLIC_SITE}/?ref=AB12CD`);
  });
});
