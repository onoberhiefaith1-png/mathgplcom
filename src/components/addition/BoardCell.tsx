import { cn } from "@/lib/utils";
import { AddRewardKind, ADD_REWARD_META } from "@/lib/additionRewards";

interface Props {
  /** "answer" or "carry" or "operand" or "empty" */
  kind: "answer" | "carry" | "operand" | "empty";
  /** Digit value to display, or null for an empty interactive box. */
  value: number | null;
  /** Hidden reward behind the box, only for interactive cells. */
  reward?: AddRewardKind;
  active?: boolean;
  correct?: boolean;
  wrong?: boolean;
  burst?: boolean;
  small?: boolean;
  onDrop?: (digit: number) => void;
  onClick?: () => void;
}

export const BoardCell = ({
  kind, value, reward, active, correct, wrong, burst, small, onDrop, onClick,
}: Props) => {
  const interactive = kind === "answer" || kind === "carry";
  const isCarry = kind === "carry";
  const meta = reward ? ADD_REWARD_META[reward] : null;

  const handleDragOver = (e: React.DragEvent) => {
    if (!interactive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!interactive || !onDrop) return;
    e.preventDefault();
    const d = e.dataTransfer.getData("text/plain");
    const n = Number(d);
    if (!Number.isNaN(n)) onDrop(n);
  };

  if (kind === "empty") {
    return <div className={cn(small ? "h-8 w-8" : "h-12 w-10 sm:h-14 sm:w-12")} />;
  }

  if (kind === "operand") {
    return (
      <div className={cn(
        "flex items-center justify-center font-black text-foreground tabular-nums",
        small ? "h-8 w-8 text-xl" : "h-12 w-10 sm:h-14 sm:w-12 text-3xl sm:text-4xl",
      )}>
        {value}
      </div>
    );
  }

  // interactive (answer / carry)
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "relative flex items-center justify-center rounded-lg border-2 select-none transition-all",
        "bg-gradient-to-b from-card/90 to-card/60 backdrop-blur-sm",
        small ? "h-8 w-8" : "h-12 w-10 sm:h-14 sm:w-12",
        isCarry
          ? "border-amber-500/40 shadow-[inset_0_1px_0_hsl(40_90%_70%/0.25)]"
          : "border-primary/40 shadow-[inset_0_1px_0_hsl(220_70%_75%/0.25)]",
        active && !value && !correct && "border-primary ring-2 ring-primary/50 animate-pulse",
        correct && "border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400/60",
        wrong && "border-rose-500 bg-rose-500/10 animate-[shake_0.4s_ease-in-out]",
        burst && "animate-[scale-in_0.4s_ease-out]",
      )}
    >
      {/* Hidden reward watermark behind the box */}
      {meta && !value && (
        <img
          src={meta.src}
          alt=""
          className={cn(
            "pointer-events-none absolute inset-1 m-auto object-contain transition-opacity",
            "opacity-25",
            burst && "opacity-100 drop-shadow-[0_0_6px_currentColor]",
          )}
          draggable={false}
        />
      )}
      {/* Burst: glowing reward on top */}
      {meta && burst && (
        <span className="absolute -inset-1 rounded-lg ring-2 ring-amber-300/70 shadow-[0_0_18px_hsl(45_95%_60%/0.8)] animate-[scale-in_0.3s_ease-out]" />
      )}
      {value !== null && (
        <span className={cn(
          "relative z-10 font-black tabular-nums drop-shadow",
          isCarry ? "text-amber-300" : "text-foreground",
          small ? "text-base" : "text-2xl sm:text-3xl",
        )}>
          {value}
        </span>
      )}
    </button>
  );
};
