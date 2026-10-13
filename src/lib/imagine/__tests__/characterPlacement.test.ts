import { describe, expect, it } from "vitest";
import { characterPlacement, clampCharacterScale } from "../characterPlacement";

describe("Game Flow placement", () => {
  it("keeps the same proportional centre and size across devices", () => {
    const tablet = characterPlacement(800, 600, { x: 60, y: 50, scale: 1 });
    const phone = characterPlacement(400, 300, { x: 60, y: 50, scale: 1 });
    expect((tablet.x + tablet.width / 2) / 800).toBe(0.6);
    expect((phone.x + phone.width / 2) / 400).toBe(0.6);
    expect(tablet.height).toBe(phone.height * 2);
  });
  it("supports smooth enlargement within the editor range", () => {
    expect(clampCharacterScale(1.05)).toBe(1.05);
    expect(clampCharacterScale(0)).toBe(0.3);
    expect(clampCharacterScale(5)).toBe(2.5);
    expect(characterPlacement(800, 600, { x: 50, y: 50, scale: 2 }).height).toBe(540);
  });
  it.each([[393, 503], [834, 503], [1280, 800]])("keeps character visible and clear of actions at %s×%s", (width, height) => {
    const position = { x: 50, y: 50, scale: 2.5 };
    const action = { x: 20, y: height * 0.5, width: width - 40, height: 50 };
    const rect = characterPlacement(width, height, position, [action]);
    expect(rect.x).toBeGreaterThanOrEqual(8);
    expect(rect.y).toBeGreaterThanOrEqual(8);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width - 8);
    expect(rect.y + rect.height).toBeLessThanOrEqual(height - 8);
    expect(rect.y + rect.height + 8 <= action.y || rect.y >= action.y + action.height + 8 || rect.x + rect.width + 8 <= action.x || rect.x >= action.x + action.width + 8).toBe(true);
    expect(position).toEqual({ x: 50, y: 50, scale: 2.5 });
  });
});