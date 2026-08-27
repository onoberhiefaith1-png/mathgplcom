// Three-view interface for a question that has a teaching video:
//   Left   → Smartboard only
//   Middle → Split view (Smartboard + video)
//   Right  → Video only
//
// The board itself is rendered by the caller and simply placed inside the
// chosen layout — mounted once, so switching views never restarts the board or
// disturbs the mathematical state.

import { useEffect, useState, type ReactNode } from "react";
import { Columns2, MonitorPlay, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionVideoConfig, VideoLine } from "@/lib/courses/questionVideo";
import QuestionVideoPane, { type LineContext } from "./QuestionVideoPane";

export type BoardVideoView = "board" | "split" | "video";

const KEY = "smartboard:videoView";

interface Props {
  config: QuestionVideoConfig;
  lines: VideoLine[];
  lineContext: LineContext;
  board: ReactNode;
}

const ThreeViewFrame = ({ config, lines, lineContext, board }: Props) => {
  // Position 1 (the Smartboard / teacher workspace) is the default.
  const [view, setView] = useState<BoardVideoView>("board");
  /** Measured bottom edge of the board's own chrome row (row 1), in px. */
  const [rowTop, setRowTop] = useState(12);


  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY) as BoardVideoView | null;
      if (saved === "board" || saved === "split" || saved === "video") setView(saved);
      else if (window.innerWidth < 900) setView("board");
    } catch { /* private mode */ }
  }, []);

  /*
    The board owns row 1 (Back · Practice · Discuss · marks) and positions it
    itself, so the only way to guarantee no overlap on every screen size is to
    measure it. The switcher then sits directly below whatever that row turns
    out to be — a vertical stack, never an overlay.
  */
  useEffect(() => {
    let raf = 0;
    const read = () => {
      const row = document.querySelector<HTMLElement>('[data-board-chrome="top"]');
      const bottom = row ? row.getBoundingClientRect().bottom : 0;
      setRowTop(bottom > 0 ? bottom + 8 : 12);
    };
    read();
    // The row mounts with the board and can change height when it wraps.
    const ro = new ResizeObserver(read);
    const row = document.querySelector<HTMLElement>('[data-board-chrome="top"]');
    if (row) ro.observe(row);
    const tick = () => { read(); raf = window.setTimeout(tick, 1000); };
    raf = window.setTimeout(tick, 300);
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      ro.disconnect();
      window.clearTimeout(raf);
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);

  const pick = (next: BoardVideoView) => {
    setView(next);
    try { window.localStorage.setItem(KEY, next); } catch { /* private mode */ }
  };

  const options: { id: BoardVideoView; label: string; Icon: typeof Columns2 }[] = [
    { id: "board", label: "Smartboard", Icon: Presentation },
    { id: "split", label: "Split view", Icon: Columns2 },
    { id: "video", label: "Video", Icon: MonitorPlay },
  ];

  return (
    <div className="relative h-full min-h-0">
      {/* Row 2 of the board chrome, measured clear of row 1 above it. */}
      <div
        className="pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2"
        style={{ top: `${rowTop}px` }}
      >


        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-card/90 p-1 shadow-lg backdrop-blur">
          {options.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              aria-label={label}
              aria-pressed={view === id}
              className={cn(
                "inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 text-[11px] font-medium transition",
                view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/*
        Both views share one height-constrained grid. On a wide screen the split
        is two columns; on a narrow one it becomes two rows that divide the
        available height, so the player never needs a fixed dvh size and nothing
        overflows.
      */}
      <div
        className={cn(
          "grid h-full min-h-0 overflow-hidden",
          view === "split"
            ? "grid-cols-1 grid-rows-[minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-cols-[1.4fr_1fr] lg:grid-rows-1"
            : "grid-cols-1 grid-rows-1",
        )}
      >
        <div className={cn("min-h-0 min-w-0", view === "video" && "hidden")}>{board}</div>
        {/*
          ONE player for the whole session. On the Smartboard-only view the pane
          is moved out of sight with CSS instead of being unmounted, so the video
          keeps playing (and the student keeps hearing it) and the playhead never
          jumps when the view changes.
        */}
        <div
          className={cn(
            "min-h-0 min-w-0",
            view === "board"
              ? "pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
              : "h-full p-2",
          )}
          aria-hidden={view === "board"}
        >
          <QuestionVideoPane config={config} lines={lines} lineContext={lineContext} />
        </div>
      </div>
    </div>
  );
};

export default ThreeViewFrame;
