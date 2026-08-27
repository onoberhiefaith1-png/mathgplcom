import { describe, expect, it } from "vitest";
import { parseAtoms } from "./atoms";

const values = (eq: string) => parseAtoms(eq, "L1").map((a) => a.value);

describe("emoji atoms stay whole", () => {
  it("reads an emoji equation without replacement characters", () => {
    const v = values("🍎 + 2🚗 = 14");
    expect(v).toEqual(["🍎", "+", "2", "🚗", "=", "14"]);
    expect(v.join("")).not.toContain("\uFFFD");
  });

  it("keeps a skin-tone and a ZWJ family emoji as one atom each", () => {
    expect(values("👍🏽 + 👨‍👩‍👧 = 2")).toEqual(["👍🏽", "+", "👨‍👩‍👧", "=", "2"]);
  });

  it("keeps an emoji whole inside brackets and a bare root", () => {
    expect(values("(3🍎)")).toEqual(["(", "3", "🍎", ")"]);
    expect(values("√🍎 + 1")).toEqual(["√", "🍎", "+", "1"]);
  });

  it("still splits ordinary mathematics as before", () => {
    expect(values("3x + 12 = 4")).toEqual(["3", "x", "+", "12", "=", "4"]);
  });
});
