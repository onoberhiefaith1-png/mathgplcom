import { describe, expect, it } from "vitest";
import { rewardLookIsHidden, rewardLookStyle } from "../rewardLook";

describe("rewardLookStyle", () => {
  it("hides the coin completely when other reward squares are hidden", () => {
    expect(rewardLookIsHidden({ visible: false, opacity: 1 })).toBe(true);
    expect(rewardLookStyle({ visible: false, opacity: 1 })).toMatchObject({
      visibility: "hidden",
      opacity: 0,
    });
  });
  it("matches opacity, glow and scale of visible reward squares", () => {
    const style = rewardLookStyle({ visible: true, opacity: 0.2, glow: 0.8, scale: 0.9 });
    expect(style.opacity).toBe(0.2);
    expect(style.transform).toBe("scale(0.9)");
    expect(String(style.filter)).toContain("drop-shadow");
  });
});
