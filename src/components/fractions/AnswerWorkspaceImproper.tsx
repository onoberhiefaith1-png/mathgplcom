import { cn } from "@/lib/utils";

export type FracSlot = "num" | "den";

interface Props {
  num: string;
  den: string;
  focus: FracSlot;
  onFocus: (s: FracSlot) => void;
  status?: "idle" | "ok" | "bad";
}

export const AnswerWorkspaceImproper = ({ num, den, focus, onFocus, status = "idle" }: Props) => {
  const ring = (s: FracSlot) =>
    cn(
      "border-2 rounded-lg transition-all flex items-center justify-center font-black tabular-nums bg-background/50",
      focus === s
        ? "border-amber-300 shadow-[0_0_18px_hsl(45_95%_60%/0.55)]"
        : "border-amber-400/40",
      status === "bad" && "border-rose-400 shadow-[0_0_18px_hsl(0_80%_60%/0.4)]",
      status === "ok" && "border-emerald-400 shadow-[0_0_18px_hsl(150_70%_50%/0.45)]",
    );
  return (
    <div className="rounded-2xl border-2 border-amber-400/40 bg-card/50 p-3 backdrop-blur">
      <div className="text-center text-[10px] uppercase tracking-[0.4em] text-amber-300 font-bold mb-2">
        Convert to Improper Fraction
      </div>
      <div className="flex items-center justify-center">
        <div className="flex flex-col items-center leading-none">
          <button
            type="button"
            onClick={() => onFocus("num")}
            className={cn(ring("num"), "h-12 w-20 text-2xl text-amber-200")}
          >
            {num || <span className="text-muted-foreground/40">·</span>}
          </button>
          <span className="h-px w-16 bg-amber-200 my-1" />
          <button
            type="button"
            onClick={() => onFocus("den")}
            className={cn(ring("den"), "h-12 w-20 text-2xl text-amber-200")}
          >
            {den || <span className="text-muted-foreground/40">·</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnswerWorkspaceImproper;
