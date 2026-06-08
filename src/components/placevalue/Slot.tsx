import { cn } from "@/lib/utils";
import { RewardKind, REWARD_META } from "@/lib/placeValueRewards";

interface Props {
  reward: RewardKind | null;
  digit: number | null;
  active?: boolean;
  hint?: boolean;
  collected?: boolean;
  onDrop: (digit: number) => void;
  onClick?: () => void;
}

export const Slot = ({ reward, digit, active, hint, collected, onDrop, onClick }: Props) => {
  const meta = reward ? REWARD_META[reward] : null;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const d = Number(e.dataTransfer.getData("text/plain"));
        if (!Number.isNaN(d)) onDrop(d);
      }}
      onClick={() => onClick?.()}
      className={cn(
        "relative flex h-11 w-9 sm:h-12 sm:w-10 items-center justify-center rounded-md border-2 transition-all cursor-pointer shadow-inner",
        "border-primary/40 bg-gradient-to-b from-card to-card/60",
        active && "ring-2 ring-primary/70 border-primary",
        hint && "ring-2 ring-primary border-primary animate-pulse",
      )}
    >
      {meta && (
        <img
          src={meta.src}
          alt=""
          className={cn(
            "absolute h-7 w-7 sm:h-8 sm:w-8 object-contain transition-opacity drop-shadow",
            collected ? "opacity-0" : digit !== null ? "opacity-25" : "opacity-70",
          )}
          draggable={false}
        />
      )}
      {digit !== null && (
        <span className="relative text-xl sm:text-2xl font-black tabular-nums text-foreground drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]">
          {digit}
        </span>
      )}
    </div>
  );
};
