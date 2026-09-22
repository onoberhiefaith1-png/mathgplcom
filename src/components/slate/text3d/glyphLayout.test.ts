import { describe, expect, it } from "vitest";
import { containGlyphBoxes, containHorizontalSpan, glyphBoxesInsideWidth, textLocalHorizontalBounds, visualTextLines } from "./glyphLayout";
import type { GlyphBox } from "./glyphLayout";

describe("Game text visual containment", () => {
  it("splits long unbroken 3D text before it can escape the writing surface", () => {
    const lines = visualTextLines("a".repeat(40), null, 0.5, 2, 1.25);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.text.length <= 6)).toBe(true);
    expect(lines[1]?.top).toBeLessThan(lines[0]?.top ?? 0);
  });

  it("keeps physical glyph decorations out when their boxes exceed the surface", () => {
    const inside: GlyphBox[] = [{ index: 0, char: "x", x: 0.5, y: 0, w: 0.2, h: 0.4 }];
    const outside: GlyphBox[] = [{ index: 0, char: "x", x: 2.2, y: 0, w: 0.4, h: 0.4 }];

    expect(glyphBoxesInsideWidth(inside, 2, "left")).toBe(true);
    expect(glyphBoxesInsideWidth(outside, 2, "left")).toBe(false);
  });

  it("repairs a shifted raised equation before it reaches the visible margin", () => {
    const shifted: GlyphBox[] = [
      { index: 0, char: "x", x: -1.4, y: 0, w: 0.3, h: 0.5 },
      { index: 1, char: "=", x: -0.8, y: 0, w: 0.3, h: 0.5 },
      { index: 2, char: "1", x: -0.2, y: 0, w: 0.3, h: 0.5 },
    ];
    const repair = containGlyphBoxes(shifted, 2, "left");

    expect(repair.fits).toBe(true);
    expect(repair.shiftX).toBeGreaterThan(0);
    expect(repair.left).toBeGreaterThanOrEqual(0);
    expect(repair.right).toBeLessThanOrEqual(2);
  });

  it("keeps each alignment inside its own canonical local frame", () => {
    expect(textLocalHorizontalBounds(4, "left")).toEqual({ left: 0, right: 4 });
    expect(textLocalHorizontalBounds(4, "center")).toEqual({ left: -2, right: 2 });
    expect(textLocalHorizontalBounds(4, "right")).toEqual({ left: -4, right: 0 });
  });

  it("rejects physical geometry that cannot fit so the safe renderer takes over", () => {
    const tooWide: GlyphBox[] = [
      { index: 0, char: "x", x: -1, y: 0, w: 1, h: 0.5 },
      { index: 1, char: "2", x: 1, y: 0, w: 1, h: 0.5 },
    ];
    expect(containGlyphBoxes(tooWide, 2, "center").fits).toBe(false);
  });

  it("repairs Surface Test block bounds using the same writing frame", () => {
    const repair = containHorizontalSpan(-0.65, 1.15, 2, "left");
    expect(repair).toMatchObject({ fits: true, shiftX: 0.65, left: 0, right: 1.8 });
  });
});