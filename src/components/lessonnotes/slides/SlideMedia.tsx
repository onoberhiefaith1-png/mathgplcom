// Renders one stored Slide item (screenshot / image / video) from its private
// storage path via a signed URL.
import { useEffect, useState } from "react";
import { slideMediaUrl, type SlideItem } from "@/lib/lessonnotes/slides";

export function SlideMedia({ item, muted = false }: { item: SlideItem; muted?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    slideMediaUrl(item.storage_path)
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [item.storage_path]);

  if (!url) {
    return <div className="h-full w-full rounded bg-slate-200/60 animate-pulse" />;
  }
  if (item.kind === "video") {
    return (
      <video
        src={url}
        controls
        muted={muted}
        playsInline
        className="h-full w-full rounded object-contain"
      />
    );
  }
  return <img src={url} alt="" className="h-full w-full rounded object-contain" draggable={false} />;
}
