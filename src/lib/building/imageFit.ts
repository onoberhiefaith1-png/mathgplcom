/**
 * Physical-panel image fitting for building surfaces.
 *
 * An uploaded image behaves like a plasterboard / wallpaper panel cut to fit
 * the surface: it covers the whole surface, keeps its own aspect ratio, and
 * crops the excess — never stretches or distorts. This is the UV-space
 * equivalent of `background-size: cover`, with zoom (scale) and pan
 * (offsetX/offsetY) as the teacher's adjustment controls.
 */

export interface CoverFit {
  repeat: [number, number];
  offset: [number, number];
}

/**
 * Cover-fit UV repeat/offset for a plane of `planeW x planeH` units and an
 * image of `imgW x imgH` pixels.
 *
 * The visible window is a sub-rectangle OF THE IMAGE with the plane's aspect
 * ratio, so both repeat values are <= 1: the image always fills the surface
 * and the excess is cropped, never letterboxed. (An earlier version scaled the
 * UVs past 1, which sampled clamped edge pixels — on an image with a
 * transparent or dark border that read as a black wall.) Zoom crops further
 * about the centre, and pan slides the window while staying inside the image.
 */
export const coverFit = (
  planeW: number,
  planeH: number,
  imgW: number,
  imgH: number,
  zoom: number,
  panX: number,
  panY: number,
): CoverFit => {
  if (planeW <= 0 || planeH <= 0 || imgW <= 0 || imgH <= 0) {
    return { repeat: [1, 1], offset: [0, 0] };
  }
  const a = imgW / imgH;
  const p = planeW / planeH;
  // Window inside the image with the plane's aspect ratio.
  const baseX = a > p ? p / a : 1;
  const baseY = a > p ? 1 : a / p;
  const z = Math.min(4, Math.max(0.2, zoom));
  const rx = Math.min(1, baseX / z);
  const ry = Math.min(1, baseY / z);
  // Pan is a fraction of the crop slack, so the window can never leave the
  // image and expose clamped border pixels.
  const clamp = (v: number) => Math.min(1, Math.max(-1, v));
  const ox = (1 - rx) * (0.5 + 0.5 * clamp(panX));
  const oy = (1 - ry) * (0.5 + 0.5 * clamp(panY));
  return { repeat: [rx, ry], offset: [ox, oy] };
};

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read that image."));
    el.src = url;
  });

/**
 * Prepare an uploaded image for use as a 3D texture: validate, downscale the
 * long edge to at most 2048 px, flatten transparency onto white (wall panels
 * are opaque), and encode as WebP (or JPEG) at ~0.85 quality. Runs in the
 * browser; no server processing needed.
 */
export const optimizeImageForTexture = async (file: File | Blob): Promise<Blob> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG, PNG or WebP).");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const MAX = 2048;
    const s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s));
    const h = Math.max(1, Math.round(img.naturalHeight * s));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image processing is not available in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const mime = canvas.toDataURL("image/webp").startsWith("data:image/webp")
      ? "image/webp"
      : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.85));
    if (!blob) throw new Error("Image processing failed.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
};