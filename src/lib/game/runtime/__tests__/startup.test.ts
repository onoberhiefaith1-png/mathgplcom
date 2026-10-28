import { describe, expect, it } from "vitest";
import { GAME_STARTUP_DEADLINE_MS, gameStartupProgress } from "../startup";

describe("Game startup", () => {
  it("reports only completed startup milestones", () => {
    expect(gameStartupProgress({ dataReady: false, canvasReady: false, surfacesReady: false, paintedReady: false })).toBe(10);
    expect(gameStartupProgress({ dataReady: true, canvasReady: false, surfacesReady: false, paintedReady: false })).toBe(30);
    expect(gameStartupProgress({ dataReady: true, canvasReady: true, surfacesReady: false, paintedReady: false })).toBe(50);
    expect(gameStartupProgress({ dataReady: true, canvasReady: true, surfacesReady: true, paintedReady: false })).toBe(75);
    expect(gameStartupProgress({ dataReady: true, canvasReady: true, surfacesReady: true, paintedReady: true })).toBe(90);
  });

  it("caps the opening gate at ten seconds", () => {
    expect(GAME_STARTUP_DEADLINE_MS).toBe(10_000);
  });
});