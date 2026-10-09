import { memo, useEffect, useMemo, useState } from "react";
import { assetUrl, cachedAssetUrl } from "@/lib/slate/assets";
import type { BackgroundSettings } from "@/lib/slate/types";

function ImagineBackgroundBase({ background }: { background: BackgroundSettings }) {
  const initial = cachedAssetUrl(background.assetId) ?? background.src ?? null;
  const [resolved, setResolved] = useState<string | null>(initial);

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

  const style = useMemo(() => ({
    transform: `translate(${background.x}%, ${background.y}%) scale(${background.scale})`,
    opacity: background.opacity,
  }), [background.opacity, background.scale, background.x, background.y]);

  if (!resolved) return <div className="absolute inset-0 bg-muted" />;

  return background.kind === "video" ? (
    <video
      key={resolved}
      src={resolved}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      className="absolute inset-0 h-full w-full object-cover"
      style={style}
    />
  ) : (
    <img
      src={resolved}
      alt=""
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover"
      style={style}
    />
  );
}

export const ImagineBackground = memo(ImagineBackgroundBase, (previous, next) => {
  const a = previous.background;
  const b = next.background;
  return a.assetId === b.assetId && a.src === b.src && a.kind === b.kind
    && a.scale === b.scale && a.x === b.x && a.y === b.y && a.opacity === b.opacity;
});