import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAY,
  TRAY_STORAGE_KEY,
  boardInSolution,
  loadTraySettings,
  normalizeTraySettings,
  saveTraySettings,
  trayIsActive,
  trayToTrail,
} from "../traySettings";

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

describe("tray settings", () => {
  it("saves and restores length, width, speed, vibration and colour", () => {
    const storage = memoryStorage();
    const next = normalizeTraySettings({
      ...DEFAULT_TRAY,
      enabled: true,
      mode: "always",
      color: "#ff8a2e",
      length: 0.8,
      width: 0.2,
      speed: 0.9,
      vibration: 0.1,
      glow: 0.4,
      fadeSec: 2.5,
    });
    saveTraySettings(storage, next);
    expect(storage.getItem(TRAY_STORAGE_KEY)).toContain("#ff8a2e");
    expect(loadTraySettings(storage)).toEqual(next);
    const trail = trayToTrail(next);
    expect(trail.thickness).toBe(0.2);
    expect(trail.speed).toBe(0.9);
    expect(trail.length).toBe(0.8);
  });

  it("clamps a broken save back to a usable tray", () => {
    const storage = memoryStorage();
    storage.setItem(TRAY_STORAGE_KEY, "{");
    expect(loadTraySettings(storage)).toEqual(DEFAULT_TRAY);
    const n = normalizeTraySettings({ length: 9, width: -2, speed: 4, vibration: "nope", fadeSec: 0, mode: "nope", enabled: false, color: "blue" });
    expect(n.length).toBe(1);
    expect(n.width).toBe(0);
    expect(n.speed).toBe(1);
    expect(n.vibration).toBe(DEFAULT_TRAY.vibration);
    expect(n.fadeSec).toBe(0.3);
    expect(n.mode).toBe("solution");
    expect(n.enabled).toBe(false);
    expect(n.color).toBe(DEFAULT_TRAY.color);
  });

  it("stays off outside a solution unless it is set to always", () => {
    const solution = { ...DEFAULT_TRAY, enabled: true, mode: "solution" as const };
    expect(trayIsActive(solution, false)).toBe(false);
    expect(trayIsActive(solution, true)).toBe(true);
    expect(trayIsActive({ ...solution, enabled: false }, true)).toBe(false);
    expect(trayIsActive({ ...solution, mode: "always" }, false)).toBe(true);
    expect(boardInSolution({ phase: "example-step" })).toBe(true);
    expect(boardInSolution({ beatKind: "solution-step" })).toBe(true);
    expect(boardInSolution({ numbersOn: true })).toBe(true);
    expect(boardInSolution({ phase: "explanation" })).toBe(false);
  });
});
