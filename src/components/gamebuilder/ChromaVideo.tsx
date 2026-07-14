import { useEffect, useRef, useState } from "react";
import SignedMedia, { useSignedUrl } from "./SignedMedia";
import type { MediaSource } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface ChromaVideoProps {
  path?: string | null;
  source?: MediaSource;
  keyColor?: { r: number; g: number; b: number };
  tolerance?: number;
  className?: string;
  fit?: "cover" | "contain";
}

const MAX_DIST = 441.6729559;

const ChromaVideo = ({
  path,
  source = "storage",
  keyColor,
  tolerance = 0.12,
  className,
  fit = "contain",
}: ChromaVideoProps) => {
  const signed = useSignedUrl(source === "storage" ? path : null);
  const url = source === "url" ? path ?? null : signed;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url || !keyColor || failed) return;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = url;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;

    const thr = tolerance * MAX_DIST;
    const feather = thr * 0.5;
    let raf = 0;

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
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      let frame: ImageData;
      try {
        frame = ctx.getImageData(0, 0, w, h);
      } catch {
        setFailed(true);
        cancelAnimationFrame(raf);
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
    };

    video.play().catch(() => {});
    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url, keyColor?.r, keyColor?.g, keyColor?.b, tolerance, failed]);

  if (failed || !keyColor) {
    return (
      <SignedMedia path={path} source={source} mediaType="video" fit={fit} className={className} />
    );
  }

  return <canvas ref={canvasRef} className={cn("h-auto w-full", className)} />;
};

export default ChromaVideo;
