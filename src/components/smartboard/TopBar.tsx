import { Search, History as HistoryIcon, Bookmark, ChevronDown, BarChart3, Undo2, Redo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Difficulty } from "@/lib/smartboard/linearGenerator";
import { BackButton } from "@/components/common/BackButton";

interface Props {
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  onHistory: () => void;
  onSave: () => void;
  onMore: () => void;
  saved: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const PILL =
  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm transition " +
  "hover:bg-[color-mix(in_oklab,var(--sb-fg)_8%,transparent)]";

const ICON_BTN =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm transition " +
  "hover:bg-[color-mix(in_oklab,var(--sb-fg)_8%,transparent)]";

export const TopBar = ({ difficulty, onDifficulty, onHistory, onSave, onMore, saved, onUndo, onRedo, canUndo, canRedo }: Props) => {
  const navigate = useNavigate();
  const diffLabel = difficulty[0].toUpperCase() + difficulty.slice(1);

  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b"
      style={{
        color: "var(--sb-fg)",
        borderColor: "color-mix(in oklab, var(--sb-fg) 8%, transparent)",
        background: "color-mix(in oklab, var(--sb-bg) 95%, transparent)",
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-1">
        <BackButton className={ICON_BTN} style={{ color: "var(--sb-muted)" }} iconClassName="h-4 w-4">
          {" "}Back
        </BackButton>
        <button className={ICON_BTN} style={{ color: "var(--sb-muted)" }}>
          <Search className="h-4 w-4" /> Search
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={ICON_BTN}
          style={{ color: "var(--sb-muted)", opacity: canUndo ? 1 : 0.4 }}
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={ICON_BTN}
          style={{ color: "var(--sb-muted)", opacity: canRedo ? 1 : 0.4 }}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Center dropdowns */}
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger className={PILL} style={{ background: "color-mix(in oklab, var(--sb-fg) 4%, transparent)" }}>
            Algebra <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem>Algebra</DropdownMenuItem>
            <DropdownMenuItem disabled>Geometry — Soon</DropdownMenuItem>
            <DropdownMenuItem disabled>Trigonometry — Soon</DropdownMenuItem>
            <DropdownMenuItem disabled>Statistics — Soon</DropdownMenuItem>
            <DropdownMenuItem disabled>Probability — Soon</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={PILL} style={{ background: "color-mix(in oklab, var(--sb-fg) 4%, transparent)" }}>
            Linear Equations <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem>Linear Equations</DropdownMenuItem>
            <DropdownMenuItem disabled>Quadratics — Soon</DropdownMenuItem>
            <DropdownMenuItem disabled>Inequalities — Soon</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={PILL} style={{ background: "color-mix(in oklab, var(--sb-fg) 4%, transparent)" }}>
            <BarChart3 className="h-3.5 w-3.5" />
            {diffLabel} <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem onClick={() => onDifficulty("easy")}>Easy</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDifficulty("medium")}>Medium</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDifficulty("hard")}>Hard</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <button onClick={onHistory} className={ICON_BTN} style={{ color: "var(--sb-muted)" }}>
          <HistoryIcon className="h-4 w-4" /> History
        </button>
        <button
          onClick={onSave}
          className={ICON_BTN}
          style={{ color: saved ? "var(--sb-blue)" : "var(--sb-muted)" }}
        >
          <Bookmark className="h-4 w-4" /> {saved ? "Saved" : "Save"}
        </button>
        {/* More button is rendered by the page overlay (MoreMenu) so the popover can anchor to it. */}
        <span aria-hidden className="inline-block w-[72px]" />
      </div>
    </div>
  );
};

export default TopBar;
