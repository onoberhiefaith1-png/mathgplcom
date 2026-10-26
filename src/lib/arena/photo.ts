/**
 * Timer Arena — student pictures.
 *
 * A picture is shrunk on the device to a small square (256px WebP, JPEG as the
 * fallback) and stored as a data URL on the participant row. The server runs
 * the SAME validator below before saving, and only ever serves the bytes back
 * itself (`?action=photo`), so no arbitrary URL can ever reach a screen.
 */

export const PHOTO_SIZE = 256;
/** Largest decoded image we store (a 256px WebP is normally 8–25 KB). */
export const MAX_PHOTO_BYTES = 60 * 1024;
/** Hard cap for the data-URL string accepted by the API. */
export const MAX_PHOTO_CHARS = Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 40;

export type PhotoMime = "image/webp" | "image/jpeg";
export type PhotoCheck =
  | { ok: true; mime: PhotoMime; bytes: number }
  | { ok: false; reason: "format" | "too_large" | "corrupt" };

const DATA_URL =
  /^data:(image\/webp|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Decoded byte length of a base64 payload, without decoding it. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** Is this the real file signature of a WebP / JPEG? (first bytes only) */
export function sniffMime(head: Uint8Array): PhotoMime | null {
  if (
    head.length >= 3 &&
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff
  )
    return "image/jpeg";
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 && // RIFF
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50 //   WEBP
  )
    return "image/webp";
  return null;
}

const decodeHead = (b64: string): Uint8Array => {
  const slice = b64.slice(0, 24);
  const bin =
    typeof atob === "function"
      ? atob(slice)
      : Buffer.from(slice, "base64").toString("binary");
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
};

/** Validate a picture data URL: type, size, and real file signature. */
export function validatePhotoDataUrl(value: unknown): PhotoCheck {
  if (typeof value !== "string" || value.length > MAX_PHOTO_CHARS) {
    return {
      ok: false,
      reason:
        typeof value === "string" && value.length > 0 ? "too_large" : "format",
    };
  }
  const m = DATA_URL.exec(value);
  if (!m) return { ok: false, reason: "format" };
  const mime = m[1] as PhotoMime;
  const b64 = m[2]!;
  const bytes = base64Bytes(b64);
  if (bytes < 64) return { ok: false, reason: "corrupt" };
  if (bytes > MAX_PHOTO_BYTES) return { ok: false, reason: "too_large" };
  let sniffed: PhotoMime | null = null;
  try {
    sniffed = sniffMime(decodeHead(b64));
  } catch {
    sniffed = null;
  }
  if (!sniffed || sniffed !== mime) return { ok: false, reason: "corrupt" };
  return { ok: true, mime, bytes };
}

/** Centre-crop rectangle that turns a w×h image into a square. */
export function squareCrop(
  w: number,
  h: number,
): { sx: number; sy: number; side: number } {
  const side = Math.max(1, Math.min(w, h));
  return {
    sx: Math.floor((w - side) / 2),
    sy: Math.floor((h - side) / 2),
    side,
  };
}

/** Quality ladder tried until the picture fits the stored-size budget. */
export const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.46, 0.36] as const;

type CanvasLike = { toDataURL: (type?: string, quality?: number) => string };

/** Pick the best encoding that fits MAX_PHOTO_BYTES (WebP first, JPEG fallback). */
export function encodeWithinBudget(canvas: CanvasLike): string | null {
  for (const type of ["image/webp", "image/jpeg"] as const) {
    for (const q of QUALITY_STEPS) {
      const url = canvas.toDataURL(type, q);
      // Browsers that cannot encode WebP silently return PNG — skip those.
      if (!url.startsWith(`data:${type};`)) break;
      if (validatePhotoDataUrl(url).ok) return url;
    }
  }
  return null;
}

export type ResizeResult =
  | { ok: true; dataUrl: string }
  | {
      ok: false;
      reason: "not_image" | "too_big_file" | "decode_failed" | "encode_failed";
    };

/** Browser only: read a chosen file, centre-crop, resize to 256px, compress. */
export async function resizeImageToSquare(
  file: File,
  size = PHOTO_SIZE,
): Promise<ResizeResult> {
  if (!/^image\//.test(file.type)) return { ok: false, reason: "not_image" };
  if (file.size > 25 * 1024 * 1024)
    return { ok: false, reason: "too_big_file" };
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap =
      typeof createImageBitmap === "function"
        ? await createImageBitmap(file)
        : await new Promise<HTMLImageElement>((res, rej) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(url);
              res(img);
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              rej(new Error("decode"));
            };
            img.src = url;
          });
  } catch {
    return { ok: false, reason: "decode_failed" };
  }
  const w = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
  const { sx, sy, side } = squareCrop(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, reason: "encode_failed" };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  if ("close" in bitmap) bitmap.close();
  const dataUrl = encodeWithinBudget(canvas);
  return dataUrl
    ? { ok: true, dataUrl }
    : { ok: false, reason: "encode_failed" };
}

/** Same-origin path of a stored picture — the only picture source a screen renders. */
export const arenaPhotoPath = (
  code: string,
  participantId: string,
  v?: number | string | null,
): string =>
  `/api/public/arena/${encodeURIComponent(code)}?action=photo&p=${encodeURIComponent(participantId)}${v ? `&v=${encodeURIComponent(String(v))}` : ""}`;

const OWN_PHOTO =
  /^\/api\/public\/arena\/[A-Za-z0-9]{8,24}\?action=photo&p=[0-9a-fA-F-]{36}(&v=\d{1,16})?$/;
/** Screens only ever render pictures that came from our own photo endpoint. */
export const isArenaPhotoPath = (value: unknown): value is string =>
  typeof value === "string" && OWN_PHOTO.test(value);
