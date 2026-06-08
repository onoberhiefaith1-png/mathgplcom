import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onDigit: (d: number) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

export const DigitBank = ({ onDigit, onBackspace, disabled }: Props) => {
  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-card/50 p-2 sm:p-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(i)}
            className={cn(
              "h-10 w-10 rounded-lg border-2 border-amber-400/40 bg-background/60 text-lg font-black tabular-nums text-amber-200 transition-all",
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
            "h-10 w-12 rounded-lg border-2 border-rose-400/40 bg-background/60 text-rose-300 transition-all flex items-center justify-center",
            "hover:border-rose-300 hover:bg-rose-500/15 hover:scale-105 active:scale-95",
            disabled && "opacity-40 cursor-not-allowed",
          )}
          title="Backspace"
        >
          <Delete className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/70 tracking-wider">
        Tap a cell, then tap digits to fill it
      </p>
    </div>
  );
};

export default DigitBank;
