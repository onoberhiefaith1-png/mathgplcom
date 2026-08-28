// Three-view interface for a question that has a teaching video:
//   Smartboard only · Split view · Video only
//
// The board itself is rendered by the caller and simply placed inside the
// chosen layout — mounted once, so switching views never restarts the board or
// disturbs the mathematical state. The player is mounted once too: on the
// Smartboard-only view it is parked out of sight instead of unmounted, so the
// playhead never jumps.
//
// The frame owns a REAL height (its parent gives it one), which is what lets
// the player be measured and interactive. The layout switcher is rendered by
// the caller in the screen header — never as an overlay on the work surface.

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { QuestionVideoConfig, VideoLine } from "@/lib/courses/questionVideo";
import QuestionVideoPane, { type LineContext } from "./QuestionVideoPane";
import type { BoardVideoView } from "@/components/student/BoardViewSwitcher";

export type { BoardVideoView };

const KEY = "smartboard:videoView";

/** Restores the remembered layout — Smartboard first on a narrow screen. */
export const useBoardVideoView = (): [BoardVideoView, (next: BoardVideoView) => void] => {
  const [view, setView] = useState<BoardVideoView>("board");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY) as BoardVideoView | null;
      if (window.innerWidth < 900) return;
      if (saved === "board" || saved === "split" || saved === "video") setView(saved);
    } catch { /* private mode */ }
  }, []);

  const pick = (next: BoardVideoView) => {
    setView(next);
    try { window.localStorage.setItem(KEY, next); } catch { /* private mode */ }
  };

  return [view, pick];
};

interface Props {
  config: QuestionVideoConfig;
  lines: VideoLine[];
  lineContext: LineContext;
  board: ReactNode;
  view: BoardVideoView;
}

const ThreeViewFrame = ({ config, lines, lineContext, board, view }: Props) => (
  /*
    One height-constrained grid for every view. On a wide screen the split is
    two columns; on a narrow one it becomes two rows that divide the available
    height, so the player never needs a fixed dvh size and nothing overflows.
  */
  <div
    className={cn(
      "grid h-full min-h-0 overflow-hidden",
      view === "split"
        ? "grid-cols-1 grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] gap-px bg-border lg:grid-cols-[1.4fr_1fr] lg:grid-rows-1"
        : "grid-cols-1 grid-rows-1",
    )}
  >
    <div
      className={cn("relative min-h-0 min-w-0 bg-background", view === "video" && "hidden")}
      aria-hidden={view === "video"}
      // Keeps the parked board out of the tab order and out of the way of the
      // player's controls.
      {...(view === "video" ? { inert: "" as unknown as boolean } : {})}
    >
      {board}
    </div>

    <div
      className={cn(
        "min-h-0 min-w-0",
        view === "board"
          ? "pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
          : "h-full bg-background p-2",
      )}
      aria-hidden={view === "board"}
    >
      <QuestionVideoPane config={config} lines={lines} lineContext={lineContext} />
    </div>
  </div>
);

export default ThreeViewFrame;
