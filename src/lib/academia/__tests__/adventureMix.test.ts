import { describe, expect, it } from "vitest";
import { duckAmount, musicVolume, narratorVolume, normalizeAudio } from "../adventureMix";

const audio = normalizeAudio({ duckLevel: 0.1, narratorLevel: 0.7, segments: [{ start: 20, end: 30 }] });

describe("Adventure audio blend", () => {
  it("plays music at its normal level away from narration", () => {
    expect(musicVolume(1, 5, audio, 1)).toBe(1);
  });
  it("is half-way down 2.5 s before narration and fully down during it", () => {
    expect(duckAmount(17.5, audio.segments)).toBeCloseTo(0.5);
    expect(musicVolume(1, 25, audio, 1)).toBeCloseTo(0.1);
  });
  it("recovers over 5 s after narration ends", () => {
    expect(musicVolume(1, 35, audio, 1)).toBeCloseTo(1);
    expect(musicVolume(1, 32.5, audio, 1)).toBeCloseTo(0.55);
  });
  it("master volume scales the whole mix and keeps the balance", () => {
    expect(musicVolume(1, 25, audio, 0.5)).toBeCloseTo(0.05);
    expect(narratorVolume(audio, 0.5)).toBeCloseTo(0.35);
  });
  it("defaults to 10% music and 70% narrator", () => {
    expect(normalizeAudio(null)).toMatchObject({ duckLevel: 0.1, narratorLevel: 0.7 });
  });
});
