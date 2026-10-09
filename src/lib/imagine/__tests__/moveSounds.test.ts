import { describe, expect, it } from "vitest";
import { streakPitch, TYPE_THROTTLE_MS } from "../moveSounds";

describe("move sounds", () => {
  it("streak climbs in pitch", () => expect(streakPitch(2)).toBeGreaterThan(streakPitch(1)));
  it("streak pitch is capped", () => expect(streakPitch(20)).toBe(streakPitch(7)));
  it("typing throttle is 40ms", () => expect(TYPE_THROTTLE_MS).toBe(40));
});
