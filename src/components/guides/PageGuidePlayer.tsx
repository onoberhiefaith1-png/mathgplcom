// The Page Guide companion panel.
//
// A clean player: play/pause, progress, time, volume and fullscreen come from
// the browser's own controls, plus one explicit "Close Guide". Nothing
// autoplays — the user decides when to watch — and the element stays mounted so
// the playhead survives every layout switch.

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageGuide } from "@/lib/guides/pageGuides";
import { guideVideoUrl } from "@/lib/guides/pageGuides";

const PageGuidePlayer = ({ guide, onClose }: { guide: PageGuide; onClose: () => void }) => {
  const url = guideVideoUrl(guide.videoPath);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{guide.title || "Page guide"}</h2>
          {guide.description && (
            <p className="truncate text-[11px] text-muted-foreground">{guide.description}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="gap-1 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" /> Close Guide
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-black/90 p-2">
        {url ? (
          <video
            key={url}
            src={url}
            controls
            controlsList="nodownload"
            preload="metadata"
            playsInline
            className="h-full max-h-full w-full rounded-lg object-contain"
          />
        ) : (
          <p className="px-4 text-center text-sm text-muted-foreground">
            This guide has no video yet.
          </p>
        )}
      </div>
    </section>
  );
};

export default PageGuidePlayer;
