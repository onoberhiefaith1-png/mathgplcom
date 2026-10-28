import { describe, expect, it } from "vitest";
import { imagineProjectileGeometry } from "../projectileGeometry";

describe("Imagine Energy Ball projectile geometry", () => {
  it("uses and aims the Horizontal Collector for a mostly sideways target", () => {
    const shot = imagineProjectileGeometry(20, 30, 120, 80);
    expect(shot.artType).toBe("horizontal-collector");
    expect(shot.dx).toBe(100);
    expect(shot.dy).toBe(50);
    expect(shot.angle).toBeCloseTo(26.565, 2);
    expect(shot.visualAngle).toBeCloseTo(26.565, 2);
  });

  it("uses and aims the Vertical Collector for a mostly vertical target", () => {
    const shot = imagineProjectileGeometry(100, 100, 50, 250);
    expect(shot.artType).toBe("vertical-collector");
    expect(shot.dx).toBe(-50);
    expect(shot.dy).toBe(150);
    expect(shot.angle).toBeCloseTo(108.435, 2);
    expect(shot.visualAngle).toBeCloseTo(18.435, 2);
    expect(shot.distance).toBeCloseTo(Math.hypot(50, 150));
  });

  it("follows the moving ball's actual position instead of forcing a centre launch", () => {
    const shot = imagineProjectileGeometry(230, 170, 900, 700);
    expect(shot.dx).toBe(670);
    expect(shot.dy).toBe(530);
    expect(shot.angle).toBeCloseTo(Math.atan2(530, 670) * 180 / Math.PI);
  });
});