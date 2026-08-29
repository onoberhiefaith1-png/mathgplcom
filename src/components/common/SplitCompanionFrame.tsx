// The one split-view frame in MathGPL.
//
// A main work surface with an optional companion panel beside it. Three
// positions — main only · split · companion only — and BOTH panels stay mounted
// in every position, so switching never remounts the work surface (no lost
// state) and never restarts a video (no jumping playhead).
//
// Wide screens split into two columns; narrow screens into two rows that divide
// the available height, so the companion never needs a fixed dvh size.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BoardVideoView } from "@/components/student/BoardViewSwitcher";

export type SplitView = BoardVideoView;

interface Props {
  /** The real page / board. Never unmounted. */
  main: ReactNode;
  /** The companion surface (a video, a guide, a preview). Never unmounted. */
  companion: ReactNode;
  view: SplitView;
  className?: string;
  /** Wide-screen column template for the split position. */
  splitColumns?: string;
  /** Extra classes for the main panel. */
  mainClassName?: string;
  /** Extra classes for the companion panel in the split / companion positions. */
  companionClassName?: string;
}

const SplitCompanionFrame = ({
  main,
  companion,
  view,
  className,
  splitColumns = "lg:grid-cols-[1.4fr_1fr]",
  mainClassName,
  companionClassName,
}: Props) => (
  <div
    className={cn(
      "grid h-full min-h-0 overflow-hidden",
      view === "split"
        ? cn(
            "grid-cols-1 grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] gap-px bg-border lg:grid-rows-1",
            splitColumns,
          )
        : "grid-cols-1 grid-rows-1",
      className,
    )}
  >
    <div
      className={cn(
        "relative min-h-0 min-w-0 bg-background",
        view === "video" && "hidden",
        mainClassName,
      )}
      aria-hidden={view === "video"}
      // Keeps a parked work surface out of the tab order and out of the way of
      // the companion's controls.
      {...(view === "video" ? { inert: "" as unknown as boolean } : {})}
    >
      {main}
    </div>

    <div
      className={cn(
        "min-h-0 min-w-0",
        view === "board"
          ? "pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
          : cn("h-full bg-background p-2", companionClassName),
      )}
      aria-hidden={view === "board"}
    >
      {companion}
    </div>
  </div>
);

export default SplitCompanionFrame;
