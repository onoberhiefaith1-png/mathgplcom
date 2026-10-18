import { describe, expect, it } from "vitest";
import { duckAmount, musicVolume, narratorVolume, normalizeAudio, segmentsFromClips } from "../adventureMix";

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
  it("uses separate fade-in and fade-out seconds", () => {
    const a = normalizeAudio({ fadeIn: 3, fadeOut: 7, segments: [{ start: 20, end: 30 }] });
    expect(duckAmount(18.5, a.segments, a.fadeIn, a.fadeOut)).toBeCloseTo(0.5);
    expect(duckAmount(16.9, a.segments, a.fadeIn, a.fadeOut)).toBe(0);
    expect(duckAmount(33.5, a.segments, a.fadeIn, a.fadeOut)).toBeCloseTo(0.5);
  });
  it("master volume scales the whole mix and keeps the balance", () => {
    expect(musicVolume(1, 25, audio, 0.5)).toBeCloseTo(0.05);
    expect(narratorVolume(audio, 0.5)).toBeCloseTo(0.35);
  });
  it("defaults to 10% music under narration, 70% narrator, 5 s fades", () => {
    expect(normalizeAudio(null)).toMatchObject({ duckLevel: 0.1, narratorLevel: 0.7, fadeIn: 5, fadeOut: 5, music: null });
  });
  it("builds narration windows from clip times and lengths", () => {
    expect(segmentsFromClips([{ at: 23.45, duration: 4 }, { at: 0.85, duration: 6 }])).toEqual([
      { start: 0.85, end: 6.85 }, { start: 23.45, end: 27.45 },
    ]);
  });
});
