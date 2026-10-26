import { describe, it, expect } from "vitest";
import {
  MAX_PHOTO_BYTES,
  QUALITY_STEPS,
  arenaPhotoPath,
  base64Bytes,
  encodeWithinBudget,
  isArenaPhotoPath,
  sniffMime,
  squareCrop,
  validatePhotoDataUrl,
} from "@/lib/arena/photo";

const toB64 = (bytes: number[]) =>
  Buffer.from(Uint8Array.from(bytes)).toString("base64");
const webpBytes = (n: number) => [
  0x52,
  0x49,
  0x46,
  0x46,
  0,
  0,
  0,
  0,
  0x57,
  0x45,
  0x42,
  0x50,
  ...new Array(n).fill(7),
];
const jpegBytes = (n: number) => [
  0xff,
  0xd8,
  0xff,
  0xe0,
  ...new Array(n).fill(9),
];
const webp = (n = 200) => `data:image/webp;base64,${toB64(webpBytes(n))}`;
const jpeg = (n = 200) => `data:image/jpeg;base64,${toB64(jpegBytes(n))}`;

describe("Arena photo validation (server and client share this)", () => {
  it("accepts a real WebP and JPEG", () => {
    expect(validatePhotoDataUrl(webp())).toMatchObject({
      ok: true,
      mime: "image/webp",
    });
    expect(validatePhotoDataUrl(jpeg())).toMatchObject({
      ok: true,
      mime: "image/jpeg",
    });
  });
  it("rejects other types: png, gif, svg, html, plain urls", () => {
    expect(
      validatePhotoDataUrl(`data:image/png;base64,${toB64(webpBytes(200))}`),
    ).toMatchObject({ ok: false, reason: "format" });
    expect(
      validatePhotoDataUrl(
        `data:image/svg+xml;base64,${toB64([60, 115, 118, 103])}`,
      ),
    ).toMatchObject({ ok: false, reason: "format" });
    expect(validatePhotoDataUrl("https://evil.example/a.webp")).toMatchObject({
      ok: false,
      reason: "format",
    });
    expect(validatePhotoDataUrl("javascript:alert(1)")).toMatchObject({
      ok: false,
    });
    expect(validatePhotoDataUrl(null)).toMatchObject({ ok: false });
  });
  it("rejects a mislabelled file whose bytes are not the claimed image", () => {
    expect(
      validatePhotoDataUrl(`data:image/webp;base64,${toB64(jpegBytes(200))}`),
    ).toMatchObject({ ok: false, reason: "corrupt" });
    expect(
      validatePhotoDataUrl(
        `data:image/jpeg;base64,${toB64(new Array(300).fill(65))}`,
      ),
    ).toMatchObject({ ok: false, reason: "corrupt" });
  });
  it("rejects oversized and tiny payloads", () => {
    expect(validatePhotoDataUrl(webp(MAX_PHOTO_BYTES + 10))).toMatchObject({
      ok: false,
      reason: "too_large",
    });
    expect(
      validatePhotoDataUrl(`data:image/webp;base64,${toB64(webpBytes(0))}`),
    ).toMatchObject({ ok: false, reason: "corrupt" });
  });
  it("rejects stray characters in the base64 body", () => {
    expect(validatePhotoDataUrl(`${webp()}"><script>`)).toMatchObject({
      ok: false,
    });
  });
  it("sniffs signatures and counts base64 bytes", () => {
    expect(sniffMime(Uint8Array.from(webpBytes(4)))).toBe("image/webp");
    expect(sniffMime(Uint8Array.from(jpegBytes(4)))).toBe("image/jpeg");
    expect(sniffMime(Uint8Array.from([1, 2, 3, 4]))).toBeNull();
    expect(base64Bytes(toB64([1, 2, 3, 4, 5]))).toBe(5);
    expect(base64Bytes(toB64([1, 2, 3, 4]))).toBe(4);
  });
});

describe("Arena photo resizing helpers", () => {
  it("centre-crops any rectangle to a square", () => {
    expect(squareCrop(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
    expect(squareCrop(200, 400)).toEqual({ sx: 0, sy: 100, side: 200 });
    expect(squareCrop(300, 300)).toEqual({ sx: 0, sy: 0, side: 300 });
    expect(squareCrop(0, 0).side).toBe(1);
  });
  it("walks down the quality ladder until the picture fits the budget", () => {
    const asked: number[] = [];
    const canvas = {
      toDataURL: (type?: string, q?: number) => {
        asked.push(q ?? 1);
        return q! > 0.6
          ? webp(MAX_PHOTO_BYTES + 100)
          : `data:${type};base64,${toB64(webpBytes(500))}`;
      },
    };
    const out = encodeWithinBudget(canvas);
    expect(out && validatePhotoDataUrl(out).ok).toBe(true);
    expect(asked.slice(0, 3)).toEqual([
      QUALITY_STEPS[0],
      QUALITY_STEPS[1],
      QUALITY_STEPS[2],
    ]);
  });
  it("falls back to JPEG when the browser cannot encode WebP (it returns PNG)", () => {
    const canvas = {
      toDataURL: (type?: string) =>
        type === "image/webp" ? "data:image/png;base64,AAAA" : jpeg(300),
    };
    expect(encodeWithinBudget(canvas)).toMatch(/^data:image\/jpeg;/);
  });
  it("gives up cleanly when nothing fits", () => {
    expect(
      encodeWithinBudget({ toDataURL: () => "data:image/png;base64,AAAA" }),
    ).toBeNull();
  });
});

describe("only our own photo endpoint is rendered", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  it("accepts the generated path", () => {
    expect(
      isArenaPhotoPath(arenaPhotoPath("TAABCDEFGHJK", id, 1790000000000)),
    ).toBe(true);
    expect(isArenaPhotoPath(arenaPhotoPath("TAABCDEFGHJK", id))).toBe(true);
  });
  it("rejects external, protocol-relative, javascript and data urls", () => {
    for (const bad of [
      "https://evil.example/x.png",
      "//evil.example/x.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "/api/public/arena/TAABCDEFGHJK?action=board",
      null,
      undefined,
      5,
    ]) {
      expect(isArenaPhotoPath(bad as never)).toBe(false);
    }
  });
});
