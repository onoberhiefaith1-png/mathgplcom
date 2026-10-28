// Renders a live preview for an official GPL asset. Files uploaded into the
// private bucket are signed; catalogue items already published keep their URL.

import SignedMedia from "@/components/gamebuilder/SignedMedia";
import type { GplAsset } from "@/lib/gpl/assetLibrary";
import { cn } from "@/lib/utils";

interface Props {
  asset: GplAsset;
  className?: string;
}

const GplAssetPreview = ({ asset, className }: Props) => {
  const box = cn("flex h-full w-full items-center justify-center overflow-hidden", className);

  if (asset.asset_type === "emoji") {
    return (
      <div className={box}>
        <span className="text-4xl leading-none">{asset.glyph ?? "🙂"}</span>
      </div>
    );
  }

  if (asset.asset_type === "audio") {
    const src = asset.external_url ?? undefined;
    return (
      <div className={cn(box, "px-2")}>
        {src ? (
          <audio controls preload="none" src={src} className="w-full" />
        ) : (
          <span className="text-xs text-muted-foreground">Audio file</span>
        )}
      </div>
    );
  }

  if (asset.storage_path) {
    return (
      <div className={box}>
        <SignedMedia
          path={asset.storage_path}
          mediaType={asset.media_type}
          fit="contain"
          className="h-full w-full"
        />
      </div>
    );
  }

  if (asset.external_url) {
    return (
      <div className={box}>
        {asset.media_type === "video" ? (
          <video
            src={asset.external_url}
            muted
            loop
            playsInline
            autoPlay
            className="h-full w-full object-contain"
          />
        ) : (
          <img
            src={asset.external_url}
            alt={asset.name}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        )}
      </div>
    );
  }

  return (
    <div className={box}>
      <span className="text-xs text-muted-foreground">No file</span>
    </div>
  );
};

export default GplAssetPreview;
