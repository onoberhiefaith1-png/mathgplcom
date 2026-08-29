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
import type { QuestionVideoConfig, VideoLine } from "@/lib/courses/questionVideo";
import SplitCompanionFrame from "@/components/common/SplitCompanionFrame";
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

/** The question player in the shared split frame — the board is the main
 *  surface, the teaching video the companion. */
const ThreeViewFrame = ({ config, lines, lineContext, board, view }: Props) => (
  <SplitCompanionFrame
    view={view}
    main={board}
    companion={<QuestionVideoPane config={config} lines={lines} lineContext={lineContext} />}
  />
);

export default ThreeViewFrame;

