import { describe, expect, it } from "vitest";
import { characterPlacement, clampCharacterScale } from "../characterPlacement";

describe("original Flow Game placement", () => {
  it("keeps proportional centre and size across devices", () => {
    const tablet = characterPlacement(800, 600, { x: 60, y: 50, scale: 1 });
    const phone = characterPlacement(400, 300, { x: 60, y: 50, scale: 1 });
    expect((tablet.x + tablet.width / 2) / 800).toBe(0.6);
    expect((phone.x + phone.width / 2) / 400).toBe(0.6);
    expect(tablet.height).toBe(phone.height * 2);
  });
  it("restores original 0.3–10 scale without the 2.5 cap", () => {
    expect(clampCharacterScale(0)).toBe(0.3);
    expect(clampCharacterScale(5)).toBe(5);
    expect(clampCharacterScale(12)).toBe(10);
    expect(characterPlacement(800, 600, { x: 50, y: 50, scale: 10 }).width).toBe(1600);
  });
  it("moves down and diagonally without snapping or shrinking", () => {
    const first = characterPlacement(800, 600, { x: 50, y: 30, scale: 3 });
    const moved = characterPlacement(800, 600, { x: 60, y: 70, scale: 3 });
    expect(moved.x - first.x).toBe(80);
    expect(moved.y - first.y).toBe(240);
    expect(moved.width).toBe(480);
    expect(moved.height).toBe(640);
  });
});
