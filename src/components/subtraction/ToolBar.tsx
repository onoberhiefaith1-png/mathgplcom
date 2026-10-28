import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, RotateCcw, Check } from "lucide-react";
import { ToolMode } from "./SubtractionBoard";

interface Props {
  mode: ToolMode;
  onModeChange: (m: ToolMode) => void;
  onSubmit: () => void;
  canSubmit: boolean;
}

export const ToolBar = ({ mode, onModeChange, onSubmit, canSubmit }: Props) => (
  <div className="flex flex-wrap items-center justify-center gap-2">
    <button
      type="button"
      onClick={() => onModeChange(mode === "replace" ? "idle" : "replace")}
      className={cn(
        "flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black uppercase tracking-wider transition-all",
        mode === "replace"
          ? "border-sky-400 bg-sky-500/20 text-sky-200 shadow-[0_0_18px_hsl(200_80%_55%/0.55)]"
          : "border-sky-500/50 bg-sky-500/10 text-sky-300 hover:border-sky-400 hover:scale-105",
      )}
    >
      <RotateCcw className="h-4 w-4" /> Replace Digit
    </button>
    <button
      type="button"
      onClick={() => onModeChange(mode === "add" ? "idle" : "add")}
      className={cn(
        "flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black uppercase tracking-wider transition-all",
        mode === "add"
          ? "border-violet-400 bg-violet-500/20 text-violet-200 shadow-[0_0_18px_hsl(270_80%_60%/0.55)]"
          : "border-violet-500/50 bg-violet-500/10 text-violet-300 hover:border-violet-400 hover:scale-105",
      )}
    >
      <Plus className="h-4 w-4" /> Add Digit
    </button>
    <Button
      onClick={onSubmit}
      disabled={!canSubmit}
      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider px-5"
    >
      <Check className="h-4 w-4" /> Submit
    </Button>
  </div>
);
