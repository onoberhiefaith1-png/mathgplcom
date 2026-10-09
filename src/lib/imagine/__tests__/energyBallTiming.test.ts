import { describe, expect, it } from "vitest";
import { ENERGY_BALL_ARRIVAL_MS, ENERGY_BALL_CENTRE_MS, ENERGY_BALL_SPIN_MS, ENERGY_BALL_FADE_MS, ENERGY_BALL_LIFETIME_MS } from "../energyBallTiming";

describe("Energy Ball centre timing", () => {
  it("holds at the centre for three seconds before disappearing", () => {
    expect(ENERGY_BALL_CENTRE_MS).toBe(3000);
    expect(ENERGY_BALL_LIFETIME_MS - ENERGY_BALL_ARRIVAL_MS - ENERGY_BALL_FADE_MS).toBe(3000);
  });
  it("rotates three times faster than the previous 900ms rotation", () => {
    expect(ENERGY_BALL_SPIN_MS).toBe(300);
  });
});