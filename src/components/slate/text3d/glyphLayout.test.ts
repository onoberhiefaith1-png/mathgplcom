import { describe, expect, it } from "vitest";
import { glyphBoxesInsideWidth, visualTextLines } from "./glyphLayout";
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
});