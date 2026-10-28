import { memo, useEffect, useMemo, useState } from "react";
import { assetUrl, cachedAssetUrl } from "@/lib/slate/assets";
import type { BackgroundSettings } from "@/lib/slate/types";

/**
 * The background layer: always the bottom of the stack, and completely
 * independent of the Game Runtime.
 *
 * The video element is created ONCE for a given source and keeps its own
 * playback clock: changing the active line, activating a reward, tapping a
 * Floating Number or a score change must never restart or recreate it. That is
 * why this component is memoised, resolves an already-known URL synchronously,
 * and never puts game state in the element's key.
 */
function BackgroundLayerBase({ background }: { background: BackgroundSettings }) {
  const initial = cachedAssetUrl(background.assetId) ?? background.src ?? null;
  const [resolved, setResolved] = useState<string | null>(initial);

  useEffect(() => {
    let alive = true;
    if (!background.assetId) {
      setResolved(background.src ?? null);
      return;
    }
    const known = cachedAssetUrl(background.assetId);
    if (known) {
      setResolved((prev) => (prev === known ? prev : known));
      return;
    }
    void assetUrl(background.assetId).then((url) => {
      if (alive) setResolved(url ?? background.src ?? null);
    });
    return () => {
      alive = false;
    };
  }, [background.assetId, background.src]);

  const style = useMemo(
    () => ({
      transform: `translate(${background.x}%, ${background.y}%) scale(${background.scale})`,
      opacity: background.opacity,
    }),
    [background.x, background.y, background.scale, background.opacity],
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {resolved ? (
        background.kind === "video" ? (
          <video
            // Only the source identifies the element: never game state.
            key={resolved}
            src={resolved}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            className="h-full w-full object-cover"
            style={style}
          />
        ) : (
          <img
            src={resolved}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
            style={style}
          />
        )
      ) : null}
    </div>
  );
}

/** Re-renders only when the background settings themselves change. */
export const BackgroundLayer = memo(BackgroundLayerBase, (a, b) => {
  const x = a.background;
  const y = b.background;
  return (
    x.assetId === y.assetId &&
    x.src === y.src &&
    x.kind === y.kind &&
    x.x === y.x &&
    x.y === y.y &&
    x.scale === y.scale &&
    x.opacity === y.opacity
  );
});
