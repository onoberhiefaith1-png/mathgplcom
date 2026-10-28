import { describe, expect, it } from "vitest";
import { BAR_LAYER, barBoxOf, barElementFor, barPixels, coverStage, DEFAULT_BAR, PLAYER_LAYERS, STAGE_ASPECT } from "../barGeometry";
import type { CanvasElement } from "@/lib/games/types";

const el = (over: Record<string, unknown> = {}) => ({
  id: "b", kind: "progress_bar", storagePath: "", mediaType: "image", x: 0.82, y: 0.35, scale: 0.09, rotation: -12, z: 3, opacity: 0.8,
  progress: { presetId: "", segments: 10, currentMarks: 0, totalMarks: 1 }, ...over,
}) as unknown as CanvasElement;

describe("coverStage", () => {
  it("is the viewport itself on a 16:9 screen", () => {
    const s = coverStage(1600, 900);
    expect(s).toEqual({ width: 1600, height: 900, left: 0, top: 0 });
  });
  it("covers a wide phone (20:9) by cropping top and bottom, centred", () => {
    const s = coverStage(2000, 900);
    expect(s.width).toBe(2000);
    expect(s.height).toBeCloseTo(2000 / STAGE_ASPECT);
    expect(s.top).toBeCloseTo((900 - s.height) / 2);
    expect(s.left).toBe(0);
  });
  it("covers a tall screen by cropping the sides", () => {
    const s = coverStage(600, 1000);
    expect(s.height).toBeCloseTo(1000);
    expect(s.width).toBeCloseTo(1000 * STAGE_ASPECT);
    expect(s.left).toBeCloseTo((600 - s.width) / 2);
  });
  it("keeps the same stored place on the picture on every screen", () => {
    const phone = coverStage(2000, 900), desktop = coverStage(1600, 900);
    const box = barBoxOf(el());
    const fracOf = (st: ReturnType<typeof coverStage>) => barPixels(box, st).left / st.width;
    expect(fracOf(phone)).toBeCloseTo(fracOf(desktop));
  });
  it("is empty before the screen has a size", () => {
    expect(coverStage(0, 0).width).toBe(0);
  });
});

describe("bar geometry is the editor's", () => {
  it("reads centre, width share, rotation, z and opacity as stored", () => {
    const b = barBoxOf(el());
    expect(b).toMatchObject({ x: 0.82, y: 0.35, rotation: -12, z: 3, opacity: 0.8, stored: true });
    expect(b.widthPct).toBeCloseTo(9);
  });
  it("uses the defaults only when nothing is stored", () => {
    const b = barBoxOf(el({ x: undefined, y: undefined, scale: undefined, rotation: undefined, opacity: undefined }));
    expect(b).toMatchObject({ x: DEFAULT_BAR.x, y: DEFAULT_BAR.y, rotation: 0, opacity: 1, stored: false });
    expect(b.widthPct).toBeCloseTo(DEFAULT_BAR.scale * 100);
  });
  it("sizes a bar as a share of the stage, centre-anchored", () => {
    const stage = { width: 1000, height: 562.5, left: 0, top: 0 };
    const px = barPixels({ ...barBoxOf(el()), heightPerWidth: 2 }, stage);
    expect(px.width).toBeCloseTo(90);
    expect(px.height).toBeCloseTo(180);
    expect(px.left + px.width / 2).toBeCloseTo(820);
    expect(px.top + px.height / 2).toBeCloseTo(0.35 * 562.5);
  });
});

describe("barElementFor", () => {
  it("keeps the stored geometry and writes the live marks", () => {
    const out = barElementFor(el(), 3, 10);
    expect(out).toMatchObject({ x: 0.82, y: 0.35, scale: 0.09, rotation: -12, z: 3, opacity: 0.8 });
    expect(out.progress).toMatchObject({ currentMarks: 3, totalMarks: 10 });
  });
  it("clamps the value and survives a zero maximum", () => {
    expect(barElementFor(el(), 99, 10).progress?.currentMarks).toBe(10);
    expect(barElementFor(el(), 2, 0).progress?.totalMarks).toBe(1);
  });
  it("reads a Video Timer's marks as time used", () => {
    const timer = el({ progress: { presetId: "", segments: 10, currentMarks: 0, totalMarks: 1, timerDisplay: "video", timerVideo: { storagePath: "t.mp4" } } });
    expect(barElementFor(timer, 250, 1000, { fillIsTimeLeft: true }).progress?.currentMarks).toBe(750);
    expect(barElementFor(timer, 250, 1000).progress?.currentMarks).toBe(250);
  });
});

describe("stacking", () => {
  it("puts the Game in front of the bars, and the bars never take touches", () => {
    expect(PLAYER_LAYERS.game).toBeGreaterThan(PLAYER_LAYERS.defaultBars);
    expect(PLAYER_LAYERS.defaultBars).toBeGreaterThan(PLAYER_LAYERS.stage);
    expect(PLAYER_LAYERS.stage).toBeGreaterThan(PLAYER_LAYERS.backdrop);
    expect(BAR_LAYER.pointerEvents).toBe("none");
  });
});
