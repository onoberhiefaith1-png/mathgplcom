import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onDigit: (d: number) => void;
  onBackspace: () => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

export const NumberChipPad = ({ onDigit, onBackspace, onSubmit, disabled }: Props) => {
  return (
    <div className="rounded-2xl border-2 border-amber-400/40 bg-card/50 p-2 sm:p-3 backdrop-blur shadow-[0_0_20px_hsl(45_90%_55%/0.15)]">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(i)}
            className={cn(
              "h-11 w-11 rounded-lg border-2 border-amber-400/40 bg-background/60 text-xl font-black tabular-nums text-amber-200 transition-all",
              "hover:border-amber-300 hover:bg-amber-500/15 hover:scale-105 active:scale-95",
              "shadow-[inset_0_0_8px_hsl(45_95%_60%/0.15)]",
              disabled && "opacity-40 cursor-not-allowed",
            )}
          >
            {i}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          className={cn(
            "h-11 w-12 rounded-lg border-2 border-rose-400/40 bg-background/60 text-rose-300 transition-all flex items-center justify-center",
            "hover:border-rose-300 hover:bg-rose-500/15 hover:scale-105 active:scale-95",
            disabled && "opacity-40 cursor-not-allowed",
          )}
          title="Backspace"
        >
          <Delete className="h-5 w-5" />
        </button>
        {onSubmit && (
          <button
            type="button"
            disabled={disabled}
            onClick={onSubmit}
            className={cn(
              "h-11 px-4 rounded-lg border-2 border-emerald-400 bg-emerald-500/20 text-sm font-black text-emerald-100 transition-all",
              "hover:bg-emerald-500/30 hover:scale-105 active:scale-95 shadow-[0_0_18px_hsl(150_70%_50%/0.4)]",
              disabled && "opacity-40 cursor-not-allowed",
            )}
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
};

export default NumberChipPad;
