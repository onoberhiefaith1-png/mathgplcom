import { describe, expect, it } from "vitest";
import {
  GAME_WRITING_WIDTH,
  buildLayout,
  gameEstimatedTextWidth,
  gameEstimatedTextHeight,
  gameBandPosition,
  gameBandTravel,
  gameInnerWritingWidth,
  gameSafeWritingWidth,
  gameSurfaceBox,
  gameSurfaceWidth,
  gameWritingWidth,
  gameWritingBand,
  contentCharacterGap,
  writingSurfaceFrame,
  clampScrollTarget,
  gameScrollRange,
  scrollRatio,
  scrollTargetAtRatio,
} from "../layout";
import { makeSlot } from "../defaults";
import type { Slot } from "../types";
import { defaultTextSettings } from "../text3d";
import { resolveTextStyle, textVisualInsets } from "../textPresets";
import { getSurface } from "../surfaces";

const slot = (id: string, text: string): Slot => ({ ...makeSlot(), id, text });

describe("Game writing-surface layout", () => {
  it("maps the visible scrollbar to the full physical scroll range", () => {
    expect(scrollRatio(5, 0, 20)).toBe(0.25);
    expect(scrollRatio(30, 0, 20)).toBe(1);
    expect(scrollRatio(0, -5, 15)).toBe(0.25);
    expect(scrollTargetAtRatio(0.75, 0, 20)).toBe(15);
    expect(scrollTargetAtRatio(0, -5, 20)).toBe(-5);
    expect(scrollTargetAtRatio(-1, -5, 20)).toBe(-5);
    expect(clampScrollTarget(-8, { min: -5, max: 20 })).toBe(-5);
  });

  it("lets writing surface zero travel to the middle of the viewport", () => {
    const layout = buildLayout([slot("line-0", "Question"), slot("line-1", "Work")], 96);
    const range = gameScrollRange(layout);
    expect(range.min).toBeCloseTo((layout.regions[0]?.centre ?? 0) - 2.75);
    expect(range.min).toBeLessThan(0);
    expect(scrollTargetAtRatio(0, range.min, range.max)).toBe(range.min);
  });
  it("reserves the 5% to 95% writing band", () => {
    expect(GAME_WRITING_WIDTH).toBeCloseTo(6.6 * 0.9);
    expect(gameWritingWidth(4)).toBeCloseTo(3.6);
    expect(gameWritingWidth(20)).toBeCloseTo(18);
  });

  it("uses the same pillar-safe writing span in Edit and Play", () => {
    expect(gameSafeWritingWidth(20)).toBeCloseTo(18);
    expect(gameSafeWritingWidth(20, 7.4)).toBeCloseTo(7.4);
  });

  it("uses one canonical 5%-95% band for every attached object", () => {
    const band = gameWritingBand(20);
    expect(band).toEqual({ width: 18, left: -9, right: 9, centre: 0 });
    expect(gameBandPosition(0, band, 1)).toBe(-8.5);
    expect(gameBandPosition(100, band, 1)).toBe(8.5);
    expect(gameBandPosition(50, band, 1)).toBe(0);
  });

  it("stops a moving reward before its visible edge leaves the band", () => {
    const band = gameWritingBand(10);
    const origin = gameBandPosition(20, band, 1);
    expect(gameBandTravel(origin, 1, band, 1)).toBeCloseTo(6.7);
    expect(origin + gameBandTravel(origin, 1, band, 1) + 0.5).toBeCloseTo(band.right);
  });

  it("grows every surface with its own content up to the writing-band maximum", () => {
    expect(gameSurfaceWidth(12, 3)).toBe(3);
    expect(gameSurfaceWidth(12, 8)).toBe(8);
    expect(gameSurfaceWidth(7, 9)).toBe(7);
  });

  it("keeps text inside the surface padding at the maximum width", () => {
    expect(gameInnerWritingWidth(9, 0.3)).toBeCloseTo(8.4);
    expect(gameInnerWritingWidth(0.4, 0.3)).toBe(0.2);
  });

  it("keeps empty, short, and long surfaces independently sized", () => {
    const minimum = 0.9;
    expect(gameSurfaceWidth(10, minimum)).toBe(minimum);
    expect(gameSurfaceWidth(10, 2.8)).toBe(2.8);
    expect(gameSurfaceWidth(10, 14)).toBe(10);
    expect(gameSurfaceWidth(10, minimum)).toBe(minimum);
  });

  it("lets live text grow a compact surface before wrapping at the safe edge", () => {
    expect(gameEstimatedTextWidth("x = 5", 96, 10)).toBeGreaterThan(1);
    expect(gameEstimatedTextWidth("", 96, 10)).toBe(0);
    expect(gameEstimatedTextWidth("a".repeat(200), 96, 7)).toBe(7);
  });

  it("uses text estimates before renderer measurement so lines never overlap", () => {
    const layout = buildLayout(
      [slot("short", "x = 5"), slot("long", "Subtract 7 from both sides and simplify carefully")],
      96, 0.2, {}, 1.2, true,
    );
    expect(layout.regions[1]?.height).toBeGreaterThan(layout.regions[0]?.height ?? Infinity);
  });

  it("estimates wrapped text height from the same writing width", () => {
    expect(gameEstimatedTextHeight("x = 5", 96, 4)).toBeGreaterThan(0);
    expect(gameEstimatedTextHeight("a".repeat(200), 96, 1.2)).toBeGreaterThan(
      gameEstimatedTextHeight("a".repeat(20), 96, 1.2),
    );
  });

  it("grows only the surface whose rendered content is taller", () => {
    const layout = buildLayout(
      [slot("short-1", "x = 5"), slot("long", "long"), slot("short-2", "y = 2")],
      96, 0.2, { "short-1": 0.45, long: 1.8, "short-2": 0.42 }, GAME_WRITING_WIDTH, false,
    );
    expect(layout.regions[1]?.height).toBeGreaterThan(layout.regions[0]?.height ?? Infinity);
    expect(layout.regions[2]?.height).toBeLessThan(layout.regions[1]?.height ?? 0);
  });

  it("moves following surfaces down while preserving their gap", () => {
    const spacing = 0.24;
    const layout = buildLayout(
      [slot("line-2", "subtract 7 from both sides"), slot("line-3", "x = 5")],
      96,
      spacing,
      { "line-2": 1.8, "line-3": 0.5 },
      GAME_WRITING_WIDTH,
    );
    const first = layout.regions[0];
    const second = layout.regions[1];
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    if (!first || !second) return;
    expect(second.top - (first.top + first.height)).toBeCloseTo(spacing);
  });

  it("uses actual rendered surface height when preserving gaps", () => {
    const spacing = 0.24;
    const layout = buildLayout(
      [slot("line-2", "x = 5"), slot("line-3", "y = 2")],
      96,
      spacing,
      { "line-2": 0.2, "line-3": 0.2 },
      GAME_WRITING_WIDTH,
      true,
      1.25,
      { "line-2": 2.4, "line-3": 0.8 },
    );
    const first = layout.regions[0];
    const second = layout.regions[1];
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    if (!first || !second) return;
    expect(first.height).toBe(2.4);
    expect(second.top - (first.top + first.height)).toBeCloseTo(spacing);
  });

  it("calculates the same local writing box for rendering and layout", () => {
    const box = gameSurfaceBox({
      text: "a".repeat(180),
      fontSize: 96,
      writingWidth: 4,
      readOnlyWriting: true,
      inset: 0.4,
      measuredWidth: 4,
      measuredHeight: 1.7,
    });

    expect(box.surfaceWidth).toBeLessThanOrEqual(4);
    expect(box.innerWritingWidth).toBeLessThan(box.surfaceWidth);
    expect(box.surfaceHeight).toBeGreaterThan(1.7);
    const frame = writingSurfaceFrame("line", box, gameWritingBand(4));
    expect(frame.surfaceHeight / 2 - frame.innerTop).toBeCloseTo(
      frame.innerBottom + frame.surfaceHeight / 2,
      5,
    );
  });

  it("grows the writing surface when text effects need more visible room", () => {
    const surface = getSurface("whiteboard");
    const plainStyle = resolveTextStyle(surface, {
      ...defaultTextSettings(),
      shadow: false,
      glow: "off",
      depth: 0,
      bevel: 0,
    });
    const richStyle = resolveTextStyle(surface, {
      ...defaultTextSettings(),
      shadow: true,
      shadowStrength: 2,
      glow: "medium",
      glowIntensity: 2,
      depth: 3,
      bevel: 2,
    });
    const baseInput = {
      text: "2(x + 3) − 4x = 8",
      fontSize: 120,
      writingWidth: 6,
      readOnlyWriting: true,
      inset: 0.4,
      measuredWidth: 2.8,
      measuredHeight: 0.5,
    };

    const plain = gameSurfaceBox({
      ...baseInput,
      visualInsets: textVisualInsets(plainStyle, baseInput.fontSize / 220),
    });
    const rich = gameSurfaceBox({
      ...baseInput,
      visualInsets: textVisualInsets(richStyle, baseInput.fontSize / 220),
    });

    expect(rich.surfaceWidth).toBeGreaterThanOrEqual(plain.surfaceWidth);
    expect(rich.surfaceHeight).toBeGreaterThan(plain.surfaceHeight);
  });

  it("gives editable surfaces the same content-driven box as Play", () => {
    const input = {
      text: "A teacher-authored line that grows from the safe left edge",
      fontSize: 96,
      writingWidth: 4.8,
      inset: 0.4,
    };
    const playBox = gameSurfaceBox({ ...input, readOnlyWriting: true });
    const editBox = gameSurfaceBox({ ...input, readOnlyWriting: false });

    expect(editBox).toEqual(playBox);
    expect(editBox.surfaceWidth).toBeLessThanOrEqual(input.writingWidth);
  });

  it("locks panel, text and pointer target to one room-safe frame", () => {
    const band = gameWritingBand(12, 7.4);
    const box = gameSurfaceBox({
      text: "x + 7 = 12",
      fontSize: 96,
      writingWidth: band.width,
      readOnlyWriting: true,
      inset: 0.42,
    });
    const frame = writingSurfaceFrame("line-0", box, band);

    expect(frame.outerLeft).toBe(band.left);
    expect(frame.x - frame.surfaceWidth / 2).toBe(frame.outerLeft);
    expect(frame.innerLeft).toBeGreaterThan(frame.outerLeft);
    expect(frame.innerRight).toBeLessThan(frame.outerRight);
    expect(frame.innerRight - frame.innerLeft).toBeCloseTo(frame.innerWritingWidth);
  });
});
describe("Content Margin", () => {
  const box = (contentMargin: number, measuredWidth = 1.2, text = "2(x + 3) - 4x = 8") =>
    gameSurfaceBox({
      text,
      fontSize: 90,
      writingWidth: 18,
      readOnlyWriting: true,
      inset: 0.3,
      measuredWidth,
      measuredHeight: 0.4,
      contentMargin,
      foldInset: 0.1,
    });

  it("keeps the surface's left edge fixed when the margin moves", () => {
    const band = gameWritingBand(20);
    const near = writingSurfaceFrame("a", box(0), band);
    const far = writingSurfaceFrame("a", box(1.5), band);
    expect(far.outerLeft).toBe(near.outerLeft);
    expect(far.innerLeft).toBeGreaterThan(near.innerLeft);
  });

  it("grows the right edge only by what the content needs", () => {
    const near = box(0);
    const far = box(1.5);
    expect(far.surfaceWidth).toBeGreaterThan(near.surfaceWidth);
    expect(far.surfaceWidth).toBeCloseTo(near.surfaceWidth + 1.5, 5);
    expect(far.innerWritingWidth).toBeCloseTo(near.innerWritingWidth, 5);
  });

  it("gives width back when the content needs less", () => {
    expect(box(1.5, 0.4, "x = 2").surfaceWidth).toBeLessThan(
      box(1.5, 3, "2(x + 3) - 4x = 8 and more working").surfaceWidth,
    );
  });

  it("never writes on the folded part of the surface", () => {
    const withFold = box(0);
    const withoutFold = gameSurfaceBox({
      text: "2(x + 3) - 4x = 8",
      fontSize: 90,
      writingWidth: 18,
      readOnlyWriting: true,
      inset: 0.3,
      measuredWidth: 1.2,
      measuredHeight: 0.4,
    });
    expect(withFold.padX).toBeCloseTo(withoutFold.padX + 0.1, 5);
  });

  it("clamps the margin so a writing area always remains", () => {
    const tight = gameSurfaceBox({
      text: "x",
      fontSize: 90,
      writingWidth: 1.6,
      readOnlyWriting: true,
      inset: 0.3,
      contentMargin: 5,
    });
    expect(tight.innerWritingWidth).toBeGreaterThanOrEqual(0.4);
    expect(tight.surfaceWidth).toBeLessThanOrEqual(1.6);
  });

  it("is repeatable: the same inputs give the same box", () => {
    expect(box(0.8)).toEqual(box(0.8));
  });

  it("starts every line at the one margin, and moving it moves them together", () => {
    const band = gameWritingBand(20);
    const near = box(0);
    const far = box(1.2);
    const nearFrame = writingSurfaceFrame("a", near, band);
    const farFrame = writingSurfaceFrame("a", far, band);
    expect(farFrame.innerLeft - nearFrame.innerLeft).toBeCloseTo(1.2, 5);
    // the writing box the renderers use follows the same margin
    expect(farFrame.innerLeft - nearFrame.innerLeft).toBeCloseTo(1.2, 5);
  });

  it("uses the same straight margin base despite different fold padding", () => {
    const sharedStart = 0.82;
    const make = (foldInset: number) => gameSurfaceBox({
      text: "2(x + 3) - 4x = 8",
      fontSize: 90,
      writingWidth: 18,
      readOnlyWriting: true,
      inset: 0.3,
      contentMargin: 0.7,
      foldInset,
      contentStartInset: sharedStart,
      contentGap: contentCharacterGap(90),
    });
    const band = gameWritingBand(20);
    expect(writingSurfaceFrame("a", make(0.05), band).innerLeft).toBeCloseTo(
      writingSurfaceFrame("b", make(0.3), band).innerLeft,
      5,
    );
  });

  it("reserves one normal character of clear space after the line", () => {
    const fontSize = 90;
    const gap = contentCharacterGap(fontSize);
    const panel = gameSurfaceBox({
      text: "x = 2",
      fontSize,
      writingWidth: 18,
      readOnlyWriting: true,
      inset: 0.3,
      contentMargin: 0.7,
      contentStartInset: 0.82,
      contentGap: gap,
    });
    const frame = writingSurfaceFrame("a", panel, gameWritingBand(20));
    const marginX = frame.outerLeft + panel.contentStartInset + panel.contentMargin;
    expect(frame.innerLeft - marginX).toBeCloseTo(gap, 5);
  });

  it("keeps the Line tag strip before the margin and never moves it", () => {
    const tagged = (contentMargin: number) =>
      gameSurfaceBox({
        text: "2(x + 3) - 4x = 8",
        fontSize: 90,
        writingWidth: 18,
        readOnlyWriting: true,
        inset: 0.3,
        measuredWidth: 1.2,
        measuredHeight: 0.4,
        contentMargin,
        foldInset: 0.1,
        tagGutter: 0.5,
      });
    const near = tagged(0);
    const far = tagged(1.2);
    expect(near.tagGutter).toBeCloseTo(0.5, 5);
    expect(far.tagGutter).toBeCloseTo(0.5, 5);
    // the strip's own place is padX from the surface start, whatever the margin
    const band = gameWritingBand(20);
    expect(writingSurfaceFrame("a", far, band).innerLeft).toBeCloseTo(
      writingSurfaceFrame("a", near, band).innerLeft + 1.2,
      5,
    );
    expect(far.innerWritingWidth).toBeCloseTo(near.innerWritingWidth, 5);
  });
});

