import { Delete, CornerDownLeft } from "lucide-react";

interface Props {
  onPick: (d: number) => void;
  onSubmit: () => void;
  onBackspace: () => void;
}

export const DigitBank = ({ onPick, onSubmit, onBackspace }: Props) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
      {Array.from({ length: 10 }).map((_, d) => (
        <button
          key={d}
          type="button"
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/plain", String(d))}
          onClick={() => onPick(d)}
          className="h-11 w-9 sm:h-12 sm:w-11 rounded-lg border-2 border-border bg-card text-xl sm:text-2xl font-black tabular-nums text-foreground shadow hover:scale-105 hover:border-primary active:scale-95 transition-all cursor-grab active:cursor-grabbing"
          aria-label={`Digit ${d}`}
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        onClick={onBackspace}
        className="h-11 w-11 sm:h-12 sm:w-12 inline-flex items-center justify-center rounded-lg border-2 border-border bg-muted text-foreground shadow hover:scale-105 hover:border-rose-500 hover:text-rose-400 active:scale-95 transition-all"
        aria-label="Backspace"
      >
        <Delete className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onSubmit}
        className="h-11 px-3 sm:h-12 sm:px-4 inline-flex items-center justify-center gap-1 rounded-lg border-2 border-primary bg-primary text-primary-foreground font-black uppercase tracking-wider text-sm shadow-[0_0_14px_hsl(var(--primary)/0.6)] hover:scale-105 active:scale-95 transition-all"
        aria-label="Submit"
      >
        <CornerDownLeft className="h-4 w-4" /> Enter
      </button>
    </div>
  );
};
