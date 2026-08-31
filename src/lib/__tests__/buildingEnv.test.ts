import { describe, expect, it } from "vitest";
import { lightBudget, mergeEnvironment } from "../building/env";
import { DEFAULT_ENVIRONMENT } from "../building/types";

describe("mergeEnvironment", () => {
  it("returns the defaults for an empty or missing record", () => {
    expect(mergeEnvironment(null)).toEqual(DEFAULT_ENVIRONMENT);
    expect(mergeEnvironment({})).toEqual(DEFAULT_ENVIRONMENT);
  });

  it("keeps every saved value and only fills genuinely missing fields", () => {
    const saved = {
      leftWall: { color: "#112233", preset: "futuristic", scale: 1.75, offsetX: 1.3 },
      lighting: { ambient: 1.5 },
    };
    const env = mergeEnvironment(saved);
    expect(env.leftWall.color).toBe("#112233");
    expect(env.leftWall.preset).toBe("futuristic");
    expect(env.leftWall.scale).toBe(1.75);
    expect(env.leftWall.offsetX).toBe(1.3);
    // missing fields fall back, never overwrite
    expect(env.leftWall.fit).toBe(DEFAULT_ENVIRONMENT.leftWall.fit);
    expect(env.lighting.ambient).toBe(1.5);
    expect(env.lighting.intensity).toBe(DEFAULT_ENVIRONMENT.lighting.intensity);
    expect(env.rightWall).toEqual(DEFAULT_ENVIRONMENT.rightWall);
  });

  it("preserves a saved template/upload and an explicit removal", () => {
    expect(mergeEnvironment({ floor: { texture: { path: "builtin:science" } } }).floor.texture).toEqual({
      path: "builtin:science",
    });
    expect(mergeEnvironment({ floor: { texture: null } }).floor.texture).toBeNull();
  });

  it("ignores malformed values instead of rendering them", () => {
    const env = mergeEnvironment({ roof: { color: 42, scale: "big" } });
    expect(env.roof.color).toBe(DEFAULT_ENVIRONMENT.roof.color);
    expect(env.roof.scale).toBe(DEFAULT_ENVIRONMENT.roof.scale);
  });
});

describe("lightBudget", () => {
  it("clamps an extreme saved brightness so surfaces are never washed out", () => {
    const b = lightBudget({ brightness: 2, ambient: 1.5, intensity: 2.35, atmosphere: true });
    expect(b.ambient).toBeLessThanOrEqual(0.4);
    expect(b.directional).toBeLessThanOrEqual(0.4);
    expect(b.hemisphere).toBeLessThanOrEqual(1);
  });

  it("still lets administrators brighten a dim corridor", () => {
    const dim = lightBudget({ brightness: 1, ambient: 0.4, intensity: 0.8, atmosphere: false });
    const bright = lightBudget({ brightness: 1.5, ambient: 0.4, intensity: 0.8, atmosphere: false });
    expect(bright.ambient).toBeGreaterThan(dim.ambient);
    expect(bright.directional).toBeGreaterThan(dim.directional);
  });
});
