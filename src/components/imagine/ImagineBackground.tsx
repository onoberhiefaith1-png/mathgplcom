import { memo, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_GAME_BACKGROUND_URL } from "@/components/imagine/defaultBackground";
import { assetUrl, cachedAssetUrl } from "@/lib/slate/assets";
import type { BackgroundSettings } from "@/lib/slate/types";

export type AuthoredBackgroundEvent = "source-change" | "ready" | "error";

export function nextAuthoredBackgroundReady(current: boolean, event: AuthoredBackgroundEvent): boolean {
  return event === "ready" ? true : event === "error" || event === "source-change" ? false : current;
}

function ImagineBackgroundBase({ background }: { background: BackgroundSettings }) {
  const initial = cachedAssetUrl(background.assetId) ?? background.src ?? null;
  const [resolved, setResolved] = useState<string | null>(initial);
  const [authoredReady, setAuthoredReady] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    if (!background.assetId) {
      setResolved(background.src ?? null);
      return;
    }
    const known = cachedAssetUrl(background.assetId);
    if (known) {
      setResolved(known);
      return;
    }
    void assetUrl(background.assetId).then((url) => {
      if (active) setResolved(url ?? background.src ?? null);
    });
    return () => { active = false; };
  }, [background.assetId, background.src]);

  useEffect(() => {
    setAuthoredReady((current) => nextAuthoredBackgroundReady(current, "source-change"));
  }, [background.kind, resolved]);

  useEffect(() => {
    const retry = () => {
      setAuthoredReady((current) => nextAuthoredBackgroundReady(current, "source-change"));
      setRetryKey((value) => value + 1);
      const video = videoRef.current;
      if (video) {
        video.load();
        void video.play().catch(() => {});
      }
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  const style = useMemo(() => ({
    transform: `translate(${background.x}%, ${background.y}%) scale(${background.scale})`,
    opacity: background.opacity,
  }), [background.opacity, background.scale, background.x, background.y]);

  const authoredClass = `absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${authoredReady ? "opacity-100" : "opacity-0"}`;

  return <div className="absolute inset-0 overflow-hidden">
    <img
      src={DEFAULT_GAME_BACKGROUND_URL}
      alt=""
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover"
    />
    {resolved && background.kind === "video" ? (
      <video
        ref={videoRef}
        key={`${resolved}:${retryKey}`}
        src={resolved}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        className={authoredClass}
        style={style}
        onCanPlay={() => setAuthoredReady((current) => nextAuthoredBackgroundReady(current, "ready"))}
        onError={() => setAuthoredReady((current) => nextAuthoredBackgroundReady(current, "error"))}
      />
    ) : resolved ? (
      <img
        key={`${resolved}:${retryKey}`}
        src={resolved}
        alt=""
        aria-hidden
        className={authoredClass}
        style={style}
        onLoad={() => setAuthoredReady((current) => nextAuthoredBackgroundReady(current, "ready"))}
        onError={() => setAuthoredReady((current) => nextAuthoredBackgroundReady(current, "error"))}
      />
    ) : null}
  </div>;
}

export const ImagineBackground = memo(ImagineBackgroundBase, (previous, next) => {
  const a = previous.background;
  const b = next.background;
  return a.assetId === b.assetId && a.src === b.src && a.kind === b.kind
    && a.scale === b.scale && a.x === b.x && a.y === b.y && a.opacity === b.opacity;
});