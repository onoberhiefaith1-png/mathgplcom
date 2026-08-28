// The Smartboard / Split view / Video switcher.
//
// A docked control, never an overlay: it lives in the student board header, so
// it can never sit on top of the player or swallow its clicks.

import { Columns2, MonitorPlay, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

export type BoardVideoView = "board" | "split" | "video";

const OPTIONS: { id: BoardVideoView; label: string; Icon: typeof Columns2 }[] = [
  { id: "board", label: "Smartboard", Icon: Presentation },
  { id: "split", label: "Split view", Icon: Columns2 },
  { id: "video", label: "Video", Icon: MonitorPlay },
];

const BoardViewSwitcher = ({
  value,
  onChange,
  className,
}: {
  value: BoardVideoView;
  onChange: (next: BoardVideoView) => void;
  className?: string;
}) => (
  <div
    role="tablist"
    aria-label="Board and video layout"
    className={cn(
      "flex items-center gap-1 rounded-full border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur",
      className,
    )}
  >
    {OPTIONS.map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={value === id}
        aria-label={label}
        onClick={() => onChange(id)}
        className={cn(
          "inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition",
          value === id
            ? "bg-primary text-primary-foreground shadow"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    ))}
  </div>
);

export default BoardViewSwitcher;
