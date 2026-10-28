import { cn } from "@/lib/utils";

interface Props { onPick: (d: number) => void; }

export const DigitBank = ({ onPick }: Props) => (
  <div className="grid grid-cols-10 gap-1.5">
    {Array.from({ length: 10 }).map((_, d) => (
      <button
        key={d}
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", String(d));
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onPick(d)}
        className={cn(
          "h-10 sm:h-11 rounded-lg border-2 border-primary/40 bg-gradient-to-b from-card to-card/70",
          "font-black text-lg sm:text-xl tabular-nums text-foreground",
          "shadow-[inset_0_1px_0_hsl(220_70%_75%/0.3),_0_2px_4px_rgba(0,0,0,0.3)]",
          "hover:border-primary hover:scale-105 hover:shadow-[0_0_12px_hsl(220_70%_60%/0.5)] transition-all",
          "active:scale-95 cursor-grab active:cursor-grabbing",
        )}
      >
        {d}
      </button>
    ))}
  </div>
);
