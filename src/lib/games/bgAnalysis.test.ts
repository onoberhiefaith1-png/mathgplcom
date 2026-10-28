import { describe, expect, it } from "vitest";

import { analyseFrames, isLowSaturation, type RawFrame } from "./bgAnalysis";

const W = 120;
const H = 90;

const make = (
  paint: (x: number, y: number) => [number, number, number],
): RawFrame => {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const [r, g, b] = paint(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, w: W, h: H };
};

const inSubject = (x: number, y: number) => x > 40 && x < 80 && y > 20 && y < 70;

describe("analyseFrames", () => {
  it("detects a flat white backdrop", () => {
    const frame = make((x, y) => (inSubject(x, y) ? [20, 40, 90] : [255, 255, 255]));
    const result = analyseFrames([frame]);
    expect(result.keyable).toBe(true);
    expect(result.color.r).toBeGreaterThan(240);
    expect(result.color.b).toBeGreaterThan(240);
    expect(result.coverage).toBeGreaterThan(0.9);
  });

  it("accepts white with a corner falloff", () => {
    const frame = make((x, y) => {
      if (inSubject(x, y)) return [20, 40, 90];
      const shade = 255 - Math.round((x / W) * 26) - Math.round((y / H) * 26);
      return [shade, shade, shade];
    });
    const result = analyseFrames([frame]);
    expect(result.keyable).toBe(true);
    expect(isLowSaturation(result.color)).toBe(true);
  });

  it("still detects white when the subject touches an edge", () => {
    const frame = make((x, y) =>
      x < 34 || inSubject(x, y) ? [10, 10, 10] : [252, 252, 250],
    );
    const result = analyseFrames([frame]);
    expect(result.keyable).toBe(true);
    expect(result.color.r).toBeGreaterThan(230);
  });

  it("detects a green screen", () => {
    const frame = make((x, y) => (inSubject(x, y) ? [200, 180, 160] : [24, 200, 60]));
    const result = analyseFrames([frame]);
    expect(result.keyable).toBe(true);
    expect(result.color.g).toBeGreaterThan(result.color.r + 80);
  });

  it("refuses a busy photographic background", () => {
    const frame = make((x, y) => [
      (x * 7 + y * 3) % 256,
      (x * 13 + y * 29) % 256,
      (x * 31 + y * 17) % 256,
    ]);
    const result = analyseFrames([frame]);
    expect(result.keyable).toBe(false);
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("reports unreadable media", () => {
    const result = analyseFrames([]);
    expect(result.keyable).toBe(false);
    expect(result.coverage).toBe(0);
  });
});
