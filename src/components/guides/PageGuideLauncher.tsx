// The small tutorial control. Present on EVERY page.
//
// Two icons: watch the page's tutorial, and — for the administrator's accounts
// only — manage them (upload a video or paste a link). The pair can be dragged
// by a manager using its grip; where it is dropped is stored for that page and
// is where EVERY account then sees it, so it never covers a page's own controls.

import { useEffect, useRef, useState } from "react";
import { CirclePlay, GripVertical, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import BoardViewSwitcher from "@/components/student/BoardViewSwitcher";
import {
  DEFAULT_PLACEMENT,
  clampPlacement,
  loadPlacement,
  savePlacement,
  type GuidePlacement,
} from "@/lib/guides/placement";
import { usePageGuide } from "./PageGuideProvider";

/** Renders inline when a page places it in its own header, floating otherwise. */
const PageGuideLauncher = ({ inline = false }: { inline?: boolean }) => {
  const ctx = usePageGuide();
  const [placement, setPlacement] = useState<GuidePlacement>(DEFAULT_PLACEMENT);
  const dragging = useRef(false);
  const pageKey = ctx?.pageKey ?? "";
  const canManage = ctx?.canManage ?? false;

  useEffect(() => {
    let active = true;
    setPlacement(DEFAULT_PLACEMENT);
    if (!pageKey) return;
    void loadPlacement(pageKey).then((saved) => {
      if (active && saved) setPlacement(saved);
    });
    return () => {
      active = false;
    };
  }, [pageKey]);

  if (!ctx) return null;

  const { tutorials, open, view, setView, openGuide, openManager, hasTutorial } = ctx;
  const title = tutorials[0]?.title;

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!canManage) return;
    event.preventDefault();
    dragging.current = true;
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      setPlacement(
        clampPlacement({
          xPct: (e.clientX / Math.max(1, window.innerWidth)) * 100,
          yPct: (e.clientY / Math.max(1, window.innerHeight)) * 100,
        }),
      );
    };
    const stop = (e: PointerEvent) => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      const next = clampPlacement({
        xPct: (e.clientX / Math.max(1, window.innerWidth)) * 100,
        yPct: (e.clientY / Math.max(1, window.innerHeight)) * 100,
      });
      setPlacement(next);
      void savePlacement(pageKey, next)
        .then(() => toast.success("Tutorial buttons moved for everyone."))
        .catch(() => toast.error("Could not save that position."));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div
      className={cn("flex items-center gap-1.5", !inline && "pointer-events-auto fixed z-[70]")}
      style={
        inline
          ? undefined
          : {
              left: `${placement.xPct}%`,
              top: `${placement.yPct}%`,
              transform: "translate(-50%, -50%)",
            }
      }
    >
      {!inline && canManage && (
        <button
          type="button"
          onPointerDown={startDrag}
          title="Drag to move these buttons — the new spot is saved for everyone"
          aria-label="Move the tutorial buttons"
          className="inline-flex h-9 w-6 cursor-grab touch-none items-center justify-center rounded-full border border-foreground/25 bg-secondary text-secondary-foreground/80 shadow-lg ring-2 ring-background/70 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

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
          title="Manage this page's tutorial videos and links"
          aria-label="Manage this page's tutorial videos and links"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/25 bg-secondary text-secondary-foreground shadow-lg ring-2 ring-background/70 transition hover:bg-muted"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default PageGuideLauncher;
