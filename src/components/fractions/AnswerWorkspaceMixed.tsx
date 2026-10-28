import { cn } from "@/lib/utils";

export type MixedSlot = "whole" | "num" | "den";

interface Props {
  whole: string;
  num: string;
  den: string;
  focus: MixedSlot;
  onFocus: (s: MixedSlot) => void;
  status?: "idle" | "ok" | "bad";
}

export const AnswerWorkspaceMixed = ({ whole, num, den, focus, onFocus, status = "idle" }: Props) => {
  const ring = (s: MixedSlot) =>
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
        Convert to Mixed Number
      </div>
      <div className="flex items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => onFocus("whole")}
          className={cn(ring("whole"), "h-16 w-16 text-4xl text-amber-200")}
        >
          {whole || <span className="text-muted-foreground/40">·</span>}
        </button>
        <div className="flex flex-col items-center leading-none">
          <button
            type="button"
            onClick={() => onFocus("num")}
            className={cn(ring("num"), "h-7 w-10 text-base text-amber-200")}
          >
            {num || <span className="text-muted-foreground/40 text-xs">·</span>}
          </button>
          <span className="h-px w-7 bg-amber-200 my-0.5" />
          <button
            type="button"
            onClick={() => onFocus("den")}
            className={cn(ring("den"), "h-7 w-10 text-base text-amber-200")}
          >
            {den || <span className="text-muted-foreground/40 text-xs">·</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnswerWorkspaceMixed;
