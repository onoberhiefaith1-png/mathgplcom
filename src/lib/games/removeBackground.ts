import { removeBackground } from "@imgly/background-removal";
import type { MediaType } from "./types";

export const isVideoFile = (file: File) =>
  /^video\//.test(file.type) || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);

export const mediaTypeOf = (file: File): MediaType =>
  isVideoFile(file) ? "video" : "image";

export const makeTransparent = async (file: File): Promise<Blob> => {
  try {
    const blob = await removeBackground(file, {
      output: { format: "image/png", quality: 0.9 },
    });
    return blob;
  } catch (err) {
    console.error("background removal failed, using original", err);
    return file;
  }
};

export interface KeyColor {
  r: number;
  g: number;
  b: number;
}
export interface BgDetection {
  color: KeyColor;
  keyable: boolean;
}

const drawFirstFrame = (
  url: string,
  mediaType: MediaType,
): Promise<{ ctx: CanvasRenderingContext2D; w: number; h: number }> =>
  new Promise((resolve, reject) => {
    const finish = (source: CanvasImageSource, w: number, h: number) => {
      if (!w || !h) return reject(new Error("no dimensions"));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(source, 0, 0, w, h);
      resolve({ ctx, w, h });
    };

    if (mediaType === "video") {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.onerror = () => reject(new Error("video load error"));
      video.onloadeddata = () => {
        const seekTo = Math.min(0.1, (video.duration || 1) / 10);
        const grab = () => finish(video, video.videoWidth, video.videoHeight);
        video.onseeked = grab;
        try {
          video.currentTime = seekTo;
        } catch {
          grab();
        }
      };
      video.src = url;
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onerror = () => reject(new Error("image load error"));
      img.onload = () => finish(img, img.naturalWidth, img.naturalHeight);
      img.src = url;
    }
  });

export const detectMediaBackground = async (
  url: string,
  mediaType: MediaType,
): Promise<BgDetection> => {
  try {
    const { ctx, w, h } = await drawFirstFrame(url, mediaType);
    const points: [number, number][] = [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
      [Math.floor(w / 2), 0],
      [Math.floor(w / 2), h - 1],
      [0, Math.floor(h / 2)],
      [w - 1, Math.floor(h / 2)],
    ];
    const samples = points.map(([x, y]) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2] };
    });
    const avg = samples.reduce(
      (a, s) => ({ r: a.r + s.r, g: a.g + s.g, b: a.b + s.b }),
      { r: 0, g: 0, b: 0 },
    );
    const n = samples.length;
    const color = {
      r: Math.round(avg.r / n),
      g: Math.round(avg.g / n),
      b: Math.round(avg.b / n),
    };
    const variance =
      samples.reduce((acc, s) => {
        const dr = s.r - color.r;
        const dg = s.g - color.g;
        const db = s.b - color.b;
        return acc + Math.sqrt(dr * dr + dg * dg + db * db);
      }, 0) / n;
    return { color, keyable: variance < 40 };
  } catch (err) {
    console.warn("background detection failed, assuming white", err);
    return { color: { r: 255, g: 255, b: 255 }, keyable: true };
  }
};
