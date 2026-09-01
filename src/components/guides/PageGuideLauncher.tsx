// The small tutorial control. Present on EVERY page.
//
// Just an icon — no label, no "View Only" text. It sits at the top-right by
// default and can be hosted inline in a page's own header row where that corner
// is already busy, so it never covers a button, title, map or navigation.

import { CirclePlay, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import BoardViewSwitcher from "@/components/student/BoardViewSwitcher";
import { usePageGuide } from "./PageGuideProvider";

/** Renders inline when a page places it in its own header, floating otherwise. */
const PageGuideLauncher = ({ inline = false }: { inline?: boolean }) => {
  const ctx = usePageGuide();
  if (!ctx) return null;

  const { tutorials, canManage, open, view, setView, openGuide, openManager, hasTutorial } = ctx;
  const title = tutorials[0]?.title;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        // Sits clear of page headers and their own top-right controls, above
        // every page chrome layer, so it is visible on EVERY page — intro page
        // and login included.
        !inline && "pointer-events-auto fixed right-3 top-16 z-[70] sm:right-4 sm:top-20",
      )}
    >
      {open ? (
        <BoardViewSwitcher value={view} onChange={setView} mainLabel="Page" />
      ) : (
        <button
          type="button"
          onClick={hasTutorial ? openGuide : undefined}
          disabled={!hasTutorial}
          aria-label={hasTutorial ? title || "Watch the tutorial for this page" : "No tutorial yet"}
          title={hasTutorial ? title || "Watch the tutorial for this page" : "No tutorial yet"}
          className={cn(
            // Legible on any page background, light or dark.
            "inline-flex h-9 w-9 items-center justify-center rounded-full shadow-lg ring-2 ring-background/70 transition",
            hasTutorial
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "cursor-default border border-foreground/25 bg-secondary text-secondary-foreground/70",
          )}

        >
          <CirclePlay className="h-4 w-4" />
        </button>
      )}


      {canManage && (
        <button
          type="button"
          onClick={openManager}
          title="Manage this page's tutorial videos"
          aria-label="Manage this page's tutorial videos"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/25 bg-secondary text-secondary-foreground shadow-lg ring-2 ring-background/70 transition hover:bg-muted"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      )}

    </div>
  );
};

export default PageGuideLauncher;
