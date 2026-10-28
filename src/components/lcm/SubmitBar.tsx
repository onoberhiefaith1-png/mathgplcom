import { Plus, Minus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onAddRow: () => void;
  onRemoveRow: () => void;
  onSubmit: () => void;
  hint: string;
  canRemove: boolean;
  submitted: boolean;
}

export const SubmitBar = ({ onAddRow, onRemoveRow, onSubmit, hint, canRemove, submitted }: Props) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-1 rounded-lg border-2 border-sky-400/50 bg-sky-500/10 px-3 py-1.5 text-xs font-black text-sky-200 hover:border-sky-300 hover:bg-sky-500/20 transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> Add Row
        </button>
        <button
          type="button"
          onClick={onRemoveRow}
          disabled={!canRemove}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border-2 border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs font-black text-rose-200 hover:border-rose-300 hover:bg-rose-500/20 transition-all",
            !canRemove && "opacity-40 cursor-not-allowed",
          )}
        >
          <Minus className="h-3.5 w-3.5" /> Remove Row
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitted}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-400 bg-emerald-500/20 px-4 py-1.5 text-sm font-black text-emerald-100 hover:bg-emerald-500/30 hover:scale-105 transition-all shadow-[0_0_18px_hsl(150_70%_50%/0.4)]",
            submitted && "opacity-60 cursor-not-allowed",
          )}
        >
          <CheckCircle2 className="h-4 w-4" /> Submit
        </button>
      </div>
      <p className="text-center text-[11px] text-amber-200/80 tracking-wide italic max-w-md">
        {hint}
      </p>
    </div>
  );
};

export default SubmitBar;
