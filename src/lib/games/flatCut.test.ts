import { describe, expect, it } from "vitest";
import { buildBackgroundMask, cutFrame, maskCoverage } from "./flatCut";

const WHITE = { r: 255, g: 255, b: 255 };
const GREEN = { r: 32, g: 220, b: 60 };

/** Builds a frame with a backdrop colour and a filled subject rectangle. */
const makeFrame = (
  w: number,
  h: number,
  bg: [number, number, number],
  subject: { x: number; y: number; w: number; h: number; rgb: [number, number, number] },
  patch?: { x: number; y: number; w: number; h: number; rgb: [number, number, number] },
) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let rgb = bg;
      const inSubject =
        x >= subject.x && x < subject.x + subject.w && y >= subject.y && y < subject.y + subject.h;
      if (inSubject) rgb = subject.rgb;
      if (
        patch &&
        x >= patch.x && x < patch.x + patch.w && y >= patch.y && y < patch.y + patch.h
      ) {
        rgb = patch.rgb;
      }
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  return { data, w, h };
};

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3];

describe("region-aware flat cut", () => {
  it("keeps white inside the subject while removing the white backdrop", () => {
    const frame = makeFrame(
      40, 40,
      [255, 255, 255],
      { x: 10, y: 10, w: 20, h: 20, rgb: [40, 60, 120] },
      { x: 16, y: 16, w: 6, h: 4, rgb: [255, 255, 255] }, // white sign on the building
    );
    cutFrame(frame.data, 40, 40, WHITE);
    expect(alphaAt(frame.data, 40, 1, 1)).toBe(0); // backdrop gone
    expect(alphaAt(frame.data, 40, 18, 17)).toBe(255); // white sign kept
    expect(alphaAt(frame.data, 40, 12, 25)).toBe(255); // building body kept
  });

  it("keeps green on the subject when cutting a green screen", () => {
    const frame = makeFrame(
      40, 40,
      [32, 220, 60],
      { x: 8, y: 8, w: 24, h: 24, rgb: [90, 70, 60] },
      { x: 14, y: 14, w: 6, h: 6, rgb: [32, 220, 60] },
    );
    cutFrame(frame.data, 40, 40, GREEN);
    expect(alphaAt(frame.data, 40, 0, 0)).toBe(0);
    expect(alphaAt(frame.data, 40, 16, 16)).toBe(255);
  });

  it("leaves opaque subject pixels byte-identical", () => {
    const frame = makeFrame(
      30, 30, [255, 255, 255], { x: 8, y: 8, w: 14, h: 14, rgb: [12, 34, 56] },
    );
    cutFrame(frame.data, 30, 30, WHITE);
    const i = (15 * 30 + 15) * 4;
    expect([frame.data[i], frame.data[i + 1], frame.data[i + 2], frame.data[i + 3]]).toEqual([
      12, 34, 56, 255,
    ]);
  });

  it("still cuts when the subject touches an edge", () => {
    const frame = makeFrame(
      40, 40, [255, 255, 255], { x: 0, y: 20, w: 20, h: 20, rgb: [20, 20, 20] },
    );
    const result = buildBackgroundMask(frame, WHITE);
    expect(maskCoverage(result)).toBeGreaterThan(0.5);
    expect(result.mask[(30 * 40) + 5]).toBe(0);
  });

  it("tolerates a shaded / gradient white backdrop", () => {
    const w = 40, h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const shade = 232 + Math.round((y / h) * 22);
        const inSubject = x > 14 && x < 26 && y > 14 && y < 26;
        const v = inSubject ? 30 : shade;
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
    }
    cutFrame(data, w, h, { r: 243, g: 243, b: 243 });
    expect(alphaAt(data, w, 2, 38)).toBe(0);
    expect(alphaAt(data, w, 20, 20)).toBe(255);
  });

  it("global keying mode removes interior matches too", () => {
    const frame = makeFrame(
      30, 30,
      [255, 255, 255],
      { x: 8, y: 8, w: 14, h: 14, rgb: [20, 20, 20] },
      { x: 12, y: 12, w: 4, h: 4, rgb: [255, 255, 255] },
    );
    const result = buildBackgroundMask(frame, WHITE, { protectInterior: false });
    expect(result.mask[13 * 30 + 13]).toBe(1);
  });
});

describe("graded edge", () => {
  it("fades alpha across the whole feather band instead of one hard step", () => {
    const frame = makeFrame(60, 60, [255, 255, 255], {
      x: 20,
      y: 20,
      w: 20,
      h: 20,
      rgb: [40, 40, 60],
    });
    cutFrame(frame.data, 60, 60, WHITE, { feather: 3 });
    // Walking inwards along a row towards the subject, the band alpha rises.
    const outer = alphaAt(frame.data, 60, 16, 30);
    const mid = alphaAt(frame.data, 60, 18, 30);
    const inner = alphaAt(frame.data, 60, 19, 30);
    expect(outer).toBeLessThan(mid);
    expect(mid).toBeLessThan(inner);
    expect(inner).toBeLessThan(255);
    // Deep background is fully gone, subject interior fully opaque.
    expect(alphaAt(frame.data, 60, 2, 2)).toBe(0);
    expect(alphaAt(frame.data, 60, 30, 30)).toBe(255);
  });

  it("keeps a white patch inside the subject byte-identical", () => {
    const frame = makeFrame(
      60,
      60,
      [255, 255, 255],
      { x: 15, y: 15, w: 30, h: 30, rgb: [40, 40, 60] },
      { x: 26, y: 26, w: 8, h: 8, rgb: [255, 255, 255] },
    );
    const before = frame.data.slice();
    cutFrame(frame.data, 60, 60, WHITE, { feather: 3 });
    for (let y = 26; y < 34; y++) {
      for (let x = 26; x < 34; x++) {
        const i = (y * 60 + x) * 4;
        expect(frame.data[i]).toBe(before[i]);
        expect(frame.data[i + 3]).toBe(255);
      }
    }
  });
});
