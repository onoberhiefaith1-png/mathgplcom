// The small, unobtrusive Page Guide control.
//
// Hidden entirely when no published guide exists for the page (administrators
// still see it, so they can attach one). The page stays the workspace: this is a
// pill, never a modal or an overlay on the work surface.

import { PlayCircle, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import BoardViewSwitcher from "@/components/student/BoardViewSwitcher";
import { usePageGuide } from "./PageGuideProvider";

/** Renders inline when a page places it in its own header, floating otherwise. */
const PageGuideLauncher = ({ inline = false }: { inline?: boolean }) => {
  const ctx = usePageGuide();
  if (!ctx || !ctx.available) return null;

  const { guide, canManage, open, view, setView, openGuide, openManager } = ctx;
  const hasVideo = Boolean(guide?.videoPath);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        !inline && "fixed right-3 top-3 z-40",
      )}
    >
      {open && hasVideo ? (
        <BoardViewSwitcher value={view} onChange={setView} />
      ) : (
        hasVideo && (
          <button
            type="button"
            onClick={openGuide}
            title={guide?.title || "Page guide"}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-border/70 bg-card/85 px-3 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-muted"
          >
            <PlayCircle className="h-3.5 w-3.5 text-primary" />
            Guide
          </button>
        )
      )}

      {canManage && (
        <button
          type="button"
          onClick={openManager}
          title="Manage this page's guide video"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-card/85 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default PageGuideLauncher;
