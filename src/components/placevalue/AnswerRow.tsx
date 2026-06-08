import { cn } from "@/lib/utils";
import { Slot } from "./Slot";
import { RewardKind } from "@/lib/placeValueRewards";
import { RoundQuestion, formatNumber } from "@/lib/placeValue";

export interface RowState {
  question: RoundQuestion;
  rewards: (RewardKind | null)[];
  inputs: (number | null)[];
  cleared: boolean;
  wrongFlash?: boolean;
}

interface Props {
  row: RowState;
  slotCount: number;
  active: boolean;
  index: number;
  onPlace: (slot: number, digit: number) => void;
  onRemove: (slot: number) => void;
  onActivate: () => void;
}

export const AnswerRow = ({ row, slotCount, active, index, onPlace, onRemove, onActivate }: Props) => {
  const firstEmpty = row.inputs.findIndex((v) => v === null);

  return (
    <div
      onClick={onActivate}
      className={cn(
        "group relative flex items-stretch gap-0 rounded-xl border overflow-hidden transition-all duration-300 cursor-pointer",
        "bg-gradient-to-r from-card/90 via-card/70 to-card/40 hover:from-card hover:to-card/60",
        row.cleared && "opacity-0 scale-95 pointer-events-none",
        row.wrongFlash && "animate-[shake_0.4s_ease-in-out] border-rose-500 shadow-[0_0_18px_hsl(0_80%_55%/0.5)]",
        active && !row.cleared
          ? "border-primary shadow-[0_0_18px_hsl(var(--primary)/0.45)]"
          : "border-border/50 hover:border-primary/50",
      )}
    >
      <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 min-w-0">
        <span className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-colors",
          active ? "bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.6)]" : "bg-primary/20 text-primary"
        )}>
          {index + 1}
        </span>
        <span className="text-2xl sm:text-3xl font-black tabular-nums text-foreground drop-shadow">
          {formatNumber(row.question.number)}
        </span>
      </div>

      <div className="flex items-center pr-1">
        <span className={cn("text-lg font-black transition-colors", active ? "text-primary" : "text-border")}>→</span>
      </div>

      <div className="flex items-center gap-1 ml-auto pr-2 py-1.5">
        {Array.from({ length: slotCount }).map((_, i) => (
          <Slot
            key={i}
            reward={row.rewards[i]}
            digit={row.inputs[i]}
            active={active}
            hint={active && i === firstEmpty}
            onDrop={(d) => onPlace(i, d)}
            onClick={() => row.inputs[i] !== null && onRemove(i)}
          />
        ))}
      </div>
    </div>
  );
};
