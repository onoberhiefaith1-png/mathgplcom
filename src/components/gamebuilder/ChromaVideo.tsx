import { useEffect, useRef, useState } from "react";
import SignedMedia, { useSignedUrl } from "./SignedMedia";
import type { MediaSource } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface ChromaVideoProps {
  path?: string | null;
  source?: MediaSource;
  keyColor?: { r: number; g: number; b: number };
  tolerance?: number;
  /**
   * Edge softness in pixels, as measured by Final Touch. It widens the graded
   * alpha band so a halo left by the backdrop fades out instead of outlining
   * the subject.
   */
  feather?: number;
  playbackRate?: number;
  className?: string;
  fit?: "cover" | "contain";
  onLoad?: () => void;
  onError?: () => void;
}

const MAX_DIST = 441.6729559;

const ChromaVideo = ({
  path,
  source = "storage",
  keyColor,
  tolerance = 0.12,
  feather: featherPx,
  playbackRate = 1,
  className,
  fit = "contain",
  onLoad,
  onError,
}: ChromaVideoProps) => {
  const signed = useSignedUrl(source === "storage" ? path : null);
  const url = source === "url" ? path ?? null : signed;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url, keyColor?.r, keyColor?.g, keyColor?.b, tolerance]);

  useEffect(() => {
    if (!url || !keyColor || failed) return;
    const video = document.createElement("video");
    let objectUrl: string | null = null;
    let cancelled = false;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "auto";

    const thr = tolerance * MAX_DIST;
    // Final Touch measures the halo and expresses it in pixels; each pixel of
    // measured fringe widens the graded band, so the edge fades out instead of
    // ending in a hard outline. With no measurement the old band is kept.
    const feather = featherPx ? thr * 0.5 * (1 + featherPx * 0.35) : thr * 0.5;
    let raf = 0;

    let reportedReady = false;
    const reportFailure = () => {
      if (cancelled) return;
      setFailed(true);
      onError?.();
    };
    const render = () => {
      raf = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      if (!canvas || video.readyState < 2) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reportFailure();
        return;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(video, 0, 0, w, h);
      let frame: ImageData;
      try {
        frame = ctx.getImageData(0, 0, w, h);
      } catch {
        reportFailure();
        cancelAnimationFrame(raf);
        video.pause();
        return;
      }
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const dr = d[i] - keyColor.r;
        const dg = d[i + 1] - keyColor.g;
        const db = d[i + 2] - keyColor.b;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < thr) {
          d[i + 3] = 0;
        } else if (dist < thr + feather) {
          d[i + 3] = Math.round(((dist - thr) / feather) * d[i + 3]);
        }
      }
      ctx.putImageData(frame, 0, 0);
      if (!reportedReady) {
        reportedReady = true;
        onLoad?.();
      }
    };

    const start = async () => {
      let src = url;
      try {
        // Storage URLs are cross-origin signed links. Drawing them directly to a
        // canvas can taint the canvas, which makes chroma removal fail and the
        // browser falls back to the original black-background video. Fetching the
        // file first and playing a local blob keeps the canvas readable, so the
        // cut result can blend over any scene.
        const response = await fetch(url, { mode: "cors" });
        if (response.ok) {
          objectUrl = URL.createObjectURL(await response.blob());
          src = objectUrl;
        }
      } catch {
        // Public URLs may not allow CORS fetches; try direct playback as a last
        // resort and fall back to the raw video only if canvas reading fails.
      }
      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      video.crossOrigin = "anonymous";
      video.onerror = reportFailure;
      video.src = src;
      try {
        video.playbackRate = playbackRate;
      } catch {
        /* keep the browser default when this rate is refused */
      }
      await video.play().catch(reportFailure);
      if (cancelled || failed) return;
      raf = requestAnimationFrame(render);
    };

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, keyColor?.r, keyColor?.g, keyColor?.b, tolerance, featherPx, playbackRate, failed, onError, onLoad]);

  if (failed || !keyColor) {
    return (
      <SignedMedia path={path} source={source} mediaType="video" fit={fit} className={className} onLoad={onLoad} onError={onError} />
    );
  }

  return <canvas ref={canvasRef} className={cn("h-auto w-full", className)} />;
};

export default ChromaVideo;
