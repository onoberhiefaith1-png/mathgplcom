import { describe, expect, it, vi } from "vitest";
import {
  cleanAlphaEdges,
  cleanTransparencyFile,
  recoverImageTransparency,
  TransparencyCleanupError,
  type Pixels,
} from "../imageTransparency";

vi.spyOn(console, "info").mockImplementation(() => {});

const W = 96, H = 96, S = 8;
type RGBA = [number, number, number, number];
const LIGHT: RGBA = [255, 255, 255, 255];
const GREY: RGBA = [204, 204, 204, 255];

function make(w: number, h: number, paint: (x: number, y: number) => RGBA): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}
const checker = (x: number, y: number): RGBA => (((x / S) | 0) + ((y / S) | 0)) % 2 ? GREY : LIGHT;
const alphaAt = (img: Pixels, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];
const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

describe("recoverImageTransparency", () => {
  it("preserves genuine alpha exactly, including semi-transparent glass", () => {
    const img = make(W, H, (x, y) => (x < 4 ? [0, 0, 0, 0] : inRect(x, y, 40, 40, 56, 56) ? [120, 180, 220, 110] : [40, 90, 160, 255]));
    const before = new Uint8ClampedArray(img.data);
    expect(recoverImageTransparency(img)).toBe("alpha");
    expect(img.data).toEqual(before);
  });

  it("converts a baked checker into alpha and keeps an enclosed white window", () => {
    const img = make(W, H, (x, y) =>
      inRect(x, y, 40, 40, 56, 56) ? [255, 255, 255, 255] : inRect(x, y, 28, 28, 68, 68) ? [30, 70, 140, 255] : checker(x, y));
    expect(recoverImageTransparency(img)).toBe("checker");
    expect(alphaAt(img, 3, 3)).toBe(0);
    expect(alphaAt(img, 90, 50)).toBe(0);
    expect(alphaAt(img, 30, 30)).toBe(255);
    expect(alphaAt(img, 48, 48)).toBe(255); // white window survives
  });

  it("protects pale stone that touches the checker with no outline", () => {
    const STONE: RGBA = [242, 238, 228, 255];
    const img = make(W, H, (x, y) => (inRect(x, y, 24, 24, 72, 80) ? STONE : checker(x, y)));
    expect(recoverImageTransparency(img)).toBe("checker");
    expect(alphaAt(img, 4, 4)).toBe(0);
    expect(alphaAt(img, 48, 50)).toBe(255);
    // Two pixels in from every edge, and the corners, stay solid stone.
    for (const [x, y] of [[26, 50], [69, 50], [48, 26], [48, 77], [26, 26], [69, 77]]) expect(alphaAt(img, x, y)).toBe(255);
  });

  it("cuts open doorways and enclosed open windows that show the checker", () => {
    // Facade with a doorway open to the bottom edge, and a fully enclosed
    // arched window showing the checker through it.
    const img = make(W, H, (x, y) => {
      if (!inRect(x, y, 16, 16, 80, 96)) return checker(x, y);
      if (inRect(x, y, 40, 64, 56, 96)) return checker(x, y); // doorway
      if (inRect(x, y, 24, 28, 44, 48)) return checker(x, y); // window
      return [236, 228, 210, 255]; // pale sandstone
    });
    expect(recoverImageTransparency(img)).toBe("checker");
    expect(alphaAt(img, 48, 80)).toBe(0); // doorway opening
    expect(alphaAt(img, 48, 66)).toBe(0); // top of the doorway
    expect(alphaAt(img, 34, 38)).toBe(0); // enclosed window
    expect(alphaAt(img, 30, 56)).toBe(255); // wall between them
    expect(alphaAt(img, 38, 80)).toBe(255); // door jamb
  });

  it("removes a checker inside real transparent padding without making anything more opaque", () => {
    const img = make(W, H, (x, y) => {
      if (!inRect(x, y, 8, 8, 88, 88)) return [0, 0, 0, 0];
      if (inRect(x, y, 30, 30, 66, 70)) return inRect(x, y, 40, 40, 50, 50) ? [150, 200, 230, 140] : [90, 60, 40, 255];
      return checker(x, y);
    });
    expect(recoverImageTransparency(img)).toBe("alpha+checker");
    expect(alphaAt(img, 2, 2)).toBe(0);
    expect(alphaAt(img, 12, 12)).toBe(0); // baked checker now transparent
    expect(alphaAt(img, 60, 60)).toBe(255);
    expect(alphaAt(img, 45, 45)).toBe(140); // semi-transparent glass kept
  });

  it("leaves opaque scenes untouched — a real background is never removed here", () => {
    for (const bg of [[255, 255, 255, 255], [0, 177, 64, 255], [120, 160, 200, 255]] as RGBA[]) {
      const img = make(W, H, (x, y) => (inRect(x, y, 30, 30, 66, 66) ? [200, 40, 40, 255] : bg));
      const before = new Uint8ClampedArray(img.data);
      expect(recoverImageTransparency(img)).toBe("opaque");
      expect(img.data).toEqual(before);
    }
  });
});

describe("cleanAlphaEdges", () => {
  it("bleeds subject colour into invisible pixels and fixes a white outline matte only", () => {
    const img = make(W, H, (x, y) => {
      if (!inRect(x, y, 30, 30, 66, 66)) return [255, 255, 255, 0];
      if (x === 30) return [250, 250, 250, 120]; // white matte on the outline
      if (inRect(x, y, 44, 44, 52, 52)) return [230, 235, 240, 100]; // interior glass
      return [60, 30, 20, 255];
    });
    cleanAlphaEdges(img);
    const px = (x: number, y: number) => Array.from(img.data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));
    expect(px(29, 40)).toEqual([60, 30, 20, 0]);
    expect(px(30, 40)).toEqual([60, 30, 20, 120]);
    expect(px(48, 48)).toEqual([230, 235, 240, 100]);
  });
});

describe("cleanTransparencyFile", () => {
  it("reports a decode failure with a useful message and produces nothing", async () => {
    const encode = vi.fn();
    const err = await cleanTransparencyFile(new Blob(["not an image"]), {
      decode: () => Promise.reject(new Error("InvalidStateError")),
      encode,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(TransparencyCleanupError);
    expect(err.code).toBe("decode");
    expect(err.message).toMatch(/could not be read/);
    expect(encode).not.toHaveBeenCalled();
  });

  it("returns no blob for an opaque photo so the original is kept", async () => {
    const pixels = make(16, 16, () => [10, 120, 30, 255]);
    const res = await cleanTransparencyFile(new Blob(["x"]), {
      decode: async () => ({ width: 16, height: 16, pixels }),
      encode: async () => new Blob(["png"]),
    });
    expect(res.kind).toBe("opaque");
    expect(res.blob).toBeNull();
  });
});
