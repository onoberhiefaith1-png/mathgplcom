// Screenshot — a genuine screen capture, deliberately separate from the
// in-app note Capture. The browser's own screen/window/tab chooser decides
// what is grabbed, so the teacher can screenshot ANY visible surface: another
// application, a website, a PDF, an image, a document. One frame is taken at
// the surface's native resolution; the crop step happens afterwards on that
// frame, so nothing on the slide is disturbed while selecting.

export interface ScreenFrame {
  /** Object URL of the captured frame (revoke when finished). */
  url: string;
  width: number;
  height: number;
}

export class ScreenCaptureError extends Error {
  constructor(public reason: "unsupported" | "denied" | "failed") {
    super(reason);
  }
}

export const screenCaptureSupported = (): boolean =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getDisplayMedia === "function";

/** Ask for a screen / window / tab and grab a single high-resolution frame. */
export const grabScreenFrame = async (): Promise<ScreenFrame> => {
  if (!screenCaptureSupported()) throw new ScreenCaptureError("unsupported");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 5 },
      audio: false,
    });
  } catch (e) {
    const name = (e as DOMException | undefined)?.name;
    throw new ScreenCaptureError(
      name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed",
    );
  }

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();

    // Let the compositor deliver a real frame before drawing.
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const anyVideo = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      };
      if (typeof anyVideo.requestVideoFrameCallback === "function") {
        anyVideo.requestVideoFrameCallback(() => finish());
      }
      window.setTimeout(finish, 400);
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new ScreenCaptureError("failed");

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ScreenCaptureError("failed");
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) throw new ScreenCaptureError("failed");
    return { url: URL.createObjectURL(blob), width: w, height: h };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
};

/** Crop a captured frame. Fractions are 0..1 of the frame; the full frame is
 *  simply { x: 0, y: 0, w: 1, h: 1 } (full-screen / window capture). */
export const cropScreenFrame = async (
  frame: ScreenFrame,
  area: { x: number; y: number; w: number; h: number },
): Promise<Blob> => {
  const img = new Image();
  img.src = frame.url;
  await img.decode().catch(
    () =>
      new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new ScreenCaptureError("failed"));
      }),
  );

  const sx = Math.round(area.x * frame.width);
  const sy = Math.round(area.y * frame.height);
  const sw = Math.max(1, Math.round(area.w * frame.width));
  const sh = Math.max(1, Math.round(area.h * frame.height));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ScreenCaptureError("failed");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new ScreenCaptureError("failed");
  return blob;
};
