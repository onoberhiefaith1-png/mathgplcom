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
  /** Column ratio on a wide screen. Defaults to the Courses ratio. */
  splitCols?: string;
}

const SplitCompanionFrame = ({ main, companion, view, className, splitCols = "1.4fr 1fr" }: Props) => (
  <div
    className={cn("grid h-full min-h-0 overflow-hidden", className)}
    style={
      view === "split"
        ? ({ ["--split-cols" as string]: splitCols } as React.CSSProperties)
        : undefined
    }
  >
    <div
      className={cn(
        "col-start-1 row-start-1 min-h-0 min-w-0",
        view === "split" && "col-span-1",
      )}
      style={
        view === "split"
          ? undefined
          : undefined
      }
    >
      {main}
    </div>
    {companion}
  </div>
);

export default SplitCompanionFrame;
