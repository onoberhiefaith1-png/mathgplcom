import { removeBackground } from "@imgly/background-removal";
import type { MediaType } from "./types";
import { cutFrame, type FlatCutOptions } from "./flatCut";
import {
  analyseFrames,
  type BgDetection,
  type KeyColor,
  type RawFrame,
} from "./bgAnalysis";

export const isVideoFile = (file: File) =>
  /^video\//.test(file.type) || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);

export const mediaTypeOf = (file: File): MediaType =>
  isVideoFile(file) ? "video" : "image";

export const blobHasTransparency = async (blob: Blob): Promise<boolean> => {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  } finally {
    bitmap.close();
  }
};

const canvasToPng = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    // No quality argument: PNG is lossless, so the subject keeps every pixel.
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encoding the cutout failed"))), "image/png");
  });

/**
 * Region-aware cut for a flat-backdrop image: the backdrop is only what is
 * connected to the edge of the frame, so white signage or glass inside the
 * building is never removed, and opaque pixels are left untouched.
 */
const flatCutImage = async (
  file: File,
  opts: MakeTransparentOptions,
): Promise<Blob | null> => {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const detection = analyseFrames([
      { data: frame.data, w: canvas.width, h: canvas.height },
    ]);
    const key = opts.keyColor ?? detection.color;
    if (!opts.keyColor && !detection.keyable) return null;

    const coverage = cutFrame(frame.data, canvas.width, canvas.height, key, opts);
    // A cut that eats nearly everything means the key colour was wrong — better
    // to hand over to the model than to hand back a ghost.
    if (coverage < 0.02 || coverage > 0.97) return null;
    ctx.putImageData(frame, 0, 0);
    return await canvasToPng(canvas);
  } finally {
    bitmap.close();
  }
};

export interface MakeTransparentOptions extends FlatCutOptions {
  /** Skip detection and cut this colour instead. */
  keyColor?: KeyColor;
}

export const makeTransparent = async (
  file: File,
  opts: MakeTransparentOptions = {},
): Promise<Blob> => {
  // Flat backdrops (studio white, green screen, flat art) are cut by region —
  // that preserves the subject's own colours and its full resolution.
  try {
    const cut = await flatCutImage(file, opts);
    if (cut && (await blobHasTransparency(cut))) return cut;
  } catch (err) {
    console.warn("flat background cut unavailable, using the model", err);
  }

  // Photographic or busy backdrops still go through the model.
  try {
    const blob = await removeBackground(file, {
      output: { format: "image/png", quality: 1 },
    });
    const hasTransparency = await blobHasTransparency(blob);
    if (!hasTransparency) {
      throw new Error("Background removal did not create a transparent cutout");
    }
    return blob;
  } catch (err) {
    console.error("background removal failed", err);
    if (err instanceof Error) throw err;
    throw new Error("Background removal failed");
  }
};

export type { KeyColor, BgDetection } from "./bgAnalysis";
export { isLowSaturation } from "./bgAnalysis";


/** Longest we wait for a single decode or seek before moving on. */
const FRAME_TIMEOUT = 4000;
/** Frames are analysed downscaled — detection only needs the backdrop. */
const MAX_ANALYSIS_WIDTH = 320;

const scaled = (w: number, h: number) => {
  if (w <= MAX_ANALYSIS_WIDTH) return { w, h };
  const ratio = MAX_ANALYSIS_WIDTH / w;
  return { w: MAX_ANALYSIS_WIDTH, h: Math.max(1, Math.round(h * ratio)) };
};

const drawTo = (source: CanvasImageSource, w: number, h: number): RawFrame | null => {
  const size = scaled(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, size.w, size.h);
  const frame = ctx.getImageData(0, 0, size.w, size.h);
  return { data: frame.data, w: size.w, h: size.h };
};

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => reject(new Error("image load error"));
    img.onload = () => resolve(img);
    img.src = url;
    setTimeout(() => reject(new Error("image load timed out")), FRAME_TIMEOUT);
  });

const loadVideo = (url: string): Promise<HTMLVideoElement> =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => reject(new Error("video load error"));
    const ready = () => {
      if (video.videoWidth) resolve(video);
    };
    video.onloadeddata = ready;
    video.onloadedmetadata = ready;
    video.src = url;
    setTimeout(() => {
      if (video.videoWidth) resolve(video);
      else reject(new Error("video load timed out"));
    }, FRAME_TIMEOUT);
  });

/** Seeks and resolves once a frame is actually decoded, never hanging. */
const seekTo = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.onseeked = null;
      resolve();
    };
    video.onseeked = finish;
    try {
      video.currentTime = time;
    } catch {
      finish();
    }
    setTimeout(finish, FRAME_TIMEOUT);
  });

/** Grabs up to three spread-out frames of a video, or the single image frame. */
export const grabAnalysisFrames = async (
  url: string,
  mediaType: MediaType,
): Promise<RawFrame[]> => {
  if (mediaType !== "video") {
    const img = await loadImage(url);
    const frame = drawTo(img, img.naturalWidth, img.naturalHeight);
    return frame ? [frame] : [];
  }
  const video = await loadVideo(url);
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  const times = duration
    ? [duration * 0.1, duration * 0.5, duration * 0.9]
    : [0];
  const frames: RawFrame[] = [];
  for (const time of times) {
    await seekTo(video, Math.min(time, Math.max(0, duration - 0.05)));
    if (video.readyState < 2) continue;
    const frame = drawTo(video, video.videoWidth, video.videoHeight);
    if (frame) frames.push(frame);
  }
  video.removeAttribute("src");
  video.load();
  return frames;
};

/**
 * Every frame Final Touch needs: evenly spaced samples across the WHOLE clip,
 * in playback order, so the first and last frame can be compared for the loop
 * seam. A still image yields its single frame.
 */
export const grabLoopFrames = async (
  url: string,
  mediaType: MediaType,
  count = 18,
): Promise<RawFrame[]> => {
  if (mediaType !== "video") {
    const img = await loadImage(url);
    const frame = drawTo(img, img.naturalWidth, img.naturalHeight);
    return frame ? [frame] : [];
  }
  const video = await loadVideo(url);
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  const n = Math.max(2, Math.min(count, duration ? Math.round(duration * 6) : 2));
  const frames: RawFrame[] = [];
  for (let i = 0; i < n; i++) {
    const time = duration ? (duration * i) / (n - 1) : 0;
    await seekTo(video, Math.min(time, Math.max(0, duration - 0.03)));
    if (video.readyState < 2) continue;
    const frame = drawTo(video, video.videoWidth, video.videoHeight);
    if (frame) frames.push(frame);
  }
  video.removeAttribute("src");
  video.load();
  return frames;
};

/**
 * A still of the media the teacher can click to pick the background colour by
 * hand when automatic detection is unsure.
 */
export const grabPreviewFrame = async (
  url: string,
  mediaType: MediaType,
): Promise<{ dataUrl: string; frame: RawFrame } | null> => {
  try {
    if (mediaType !== "video") {
      const img = await loadImage(url);
      const size = scaled(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = size.w;
      canvas.height = size.h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, size.w, size.h);
      const data = ctx.getImageData(0, 0, size.w, size.h);
      return {
        dataUrl: canvas.toDataURL("image/jpeg", 0.8),
        frame: { data: data.data, w: size.w, h: size.h },
      };
    }
    const video = await loadVideo(url);
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    await seekTo(video, Math.min(0.1, Math.max(0, duration / 10)));
    const size = scaled(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, size.w, size.h);
    const data = ctx.getImageData(0, 0, size.w, size.h);
    video.removeAttribute("src");
    video.load();
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.8),
      frame: { data: data.data, w: size.w, h: size.h },
    };
  } catch {
    return null;
  }
};

export const detectMediaBackground = async (
  url: string,
  mediaType: MediaType,
): Promise<BgDetection> => {
  try {
    const frames = await grabAnalysisFrames(url, mediaType);
    return analyseFrames(frames);
  } catch (err) {
    console.warn("background detection failed", err);
    return {
      color: { r: 255, g: 255, b: 255 },
      keyable: false,
      coverage: 0,
      spread: 0,
      reason: "This file could not be read for background detection.",
    };
  }
};

