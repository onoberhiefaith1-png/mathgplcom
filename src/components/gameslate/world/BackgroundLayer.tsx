import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/slate/assets";
import type { BackgroundSettings } from "@/lib/slate/types";

/**
 * The background layer: always the bottom of the stack. Uploaded files live in
 * IndexedDB (resolved here), presets and legacy saves use `src` directly.
 * Scale, position and opacity come straight from settings.
 */
export function BackgroundLayer({ background }: { background: BackgroundSettings }) {
  const [resolved, setResolved] = useState<string | null>(background.src ?? null);

  useEffect(() => {
    let alive = true;
    if (!background.assetId) {
      setResolved(background.src ?? null);
      return;
    }
    void assetUrl(background.assetId).then((url) => {
      if (alive) setResolved(url ?? background.src ?? null);
    });
    return () => {
      alive = false;
    };
  }, [background.assetId, background.src]);

  const style = {
    transform: `translate(${background.x}%, ${background.y}%) scale(${background.scale})`,
    opacity: background.opacity,
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {resolved ? (
        background.kind === "video" ? (
          <video
            src={resolved}
            autoPlay
            muted
            loop
            playsInline
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
