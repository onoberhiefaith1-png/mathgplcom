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
 * rx = max(1, a/p), ry = max(p/a, 1) with image aspect a and plane aspect p,
 * so the image always fills the plane and the excess is cropped; zoom scales
 * both axes about the centre; pan shifts the visible region.
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
  const rx = Math.max(1, a / p);
  const ry = Math.max(p / a, 1);
  const z = Math.max(0.1, zoom);
  return {
    repeat: [rx * z, ry * z],
    offset: [0.5 - 0.5 * rx * z + panX, 0.5 - 0.5 * ry * z + panY],
  };
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