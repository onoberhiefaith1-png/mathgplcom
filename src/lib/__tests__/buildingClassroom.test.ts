import { describe, expect, it } from "vitest";
import { DEFAULT_ENVIRONMENT } from "@/lib/building/types";
import { classroomDimensions, classroomFloorLow } from "@/lib/building/classroom";
import {
  isDefaultSurface,
  overrideTexturePaths,
  resolveSurfaces,
  withSurfaceOverride,
  withoutSurfaceOverride,
} from "@/lib/building/resolve";

describe("classroom shells", () => {
  it("gives each professional type its own proportions", () => {
    const room = classroomDimensions("classroom");
    const hall = classroomDimensions("teaching_hall");
    const aud = classroomDimensions("auditorium");
    expect(hall.length).toBeGreaterThan(room.length);
    expect(aud.width).toBeGreaterThan(hall.width);
  });

  it("only the auditorium steps down, and it descends toward the front", () => {
    expect(classroomDimensions("classroom").tiers).toHaveLength(1);
    expect(classroomDimensions("teaching_hall").tiers).toHaveLength(1);
    const tiers = classroomDimensions("auditorium").tiers;
    expect(tiers.length).toBeGreaterThan(1);
    for (let i = 1; i < tiers.length; i += 1) {
      expect(tiers[i].y).toBeLessThan(tiers[i - 1].y);
      expect(tiers[i].from).toBeGreaterThanOrEqual(tiers[i - 1].to - 1e-6);
    }
    expect(classroomFloorLow("auditorium")).toBe(tiers[tiers.length - 1].y);
  });
});

describe("default vs individual settings", () => {
  it("inherits every field until one is overridden", () => {
    expect(resolveSurfaces(DEFAULT_ENVIRONMENT, {})).toEqual(DEFAULT_ENVIRONMENT);
    const overrides = withSurfaceOverride({}, "floor", {
      ...DEFAULT_ENVIRONMENT.floor,
      color: "#123456",
    });
    const resolved = resolveSurfaces(DEFAULT_ENVIRONMENT, overrides);
    expect(resolved.floor.color).toBe("#123456");
    expect(resolved.roof).toEqual(DEFAULT_ENVIRONMENT.roof);
    expect(resolved.leftWall).toEqual(DEFAULT_ENVIRONMENT.leftWall);
  });

  it("resetting a field puts it back on the default", () => {
    const overrides = withSurfaceOverride({}, "roof", {
      ...DEFAULT_ENVIRONMENT.roof,
      color: "#000fff",
    });
    expect(isDefaultSurface(overrides, "roof")).toBe(false);
    const cleared = withoutSurfaceOverride(overrides, "roof");
    expect(isDefaultSurface(cleared, "roof")).toBe(true);
    expect(resolveSurfaces(DEFAULT_ENVIRONMENT, cleared)).toEqual(DEFAULT_ENVIRONMENT);
  });

  it("collects textures an override introduces, so they are resolvable", () => {
    const overrides = withSurfaceOverride({}, "leftWall", {
      ...DEFAULT_ENVIRONMENT.leftWall,
      texture: { path: "org/wall.png" },
    });
    expect(overrideTexturePaths([overrides])).toContain("org/wall.png");
  });
});
