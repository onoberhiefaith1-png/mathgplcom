// Renders one stored Slide item (screenshot / image / video) from its private
// storage path via a signed URL. A signed URL can expire while the panel stays
// open, so a failed load is retried with a freshly minted URL rather than
// leaving the teacher with a silently blank slide object.
import { useCallback, useEffect, useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import { slideMediaUrl, type SlideItem } from "@/lib/lessonnotes/slides";

export function SlideMedia({ item, muted = false }: { item: SlideItem; muted?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUrl(null);
    slideMediaUrl(item.storage_path)
      .then((u) => { if (alive) { setUrl(u); if (!u) setFailed(true); } })
      .catch(() => { if (alive) { setUrl(null); setFailed(true); } });
    return () => { alive = false; };
  }, [item.storage_path, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-muted/60 p-2 text-center">
        <ImageOff className="h-4 w-4 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">This media could not be loaded.</p>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={retry}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium hover:bg-background"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

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
        onError={() => setFailed(true)}
        className="h-full w-full rounded object-contain"
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setFailed(true)}
      className="h-full w-full rounded object-contain"
      draggable={false}
    />
  );
}
