import { cn } from "@/lib/utils";
import { BIDMAS_REWARD_META, BidmasRewardKind } from "@/lib/bidmasRewards";

export interface EditableRow {
  divisor: string;
  values: string[];
  status?: "ok" | "bad" | null;
}

export type FocusTarget = { rowIdx: number; col: "div" | number };

interface Props {
  rows: EditableRow[];
  focus: FocusTarget | null;
  onFocus: (t: FocusTarget) => void;
  /** True after a successful submit — rewards inside cells light up. */
  lit: boolean;
}

/** Deterministic per-cell reward — ~80% coin, 20% diamond/crown rotation. */
export const cellReward = (r: number, c: number): BidmasRewardKind => {
  const idx = r * 7 + c * 3;
  const m = idx % 10;
  if (m === 2) return "diamond";
  if (m === 7) return "crown";
  return "coin";
};

const RewardBg = ({ kind, bright }: { kind: BidmasRewardKind; bright: boolean }) => (
  <img
    src={BIDMAS_REWARD_META[kind].src}
    alt=""
    aria-hidden
    className={cn(
      "pointer-events-none absolute inset-0 m-auto h-7 w-7 sm:h-8 sm:w-8 transition-all duration-500",
      bright
        ? "opacity-90 drop-shadow-[0_0_10px_hsl(45_95%_60%/0.9)] animate-pulse"
        : "opacity-20 blur-[1.5px]",
    )}
  />
);

export const LcmLadder = ({ rows, focus, onFocus, lit }: Props) => {
  const colCount = rows[0]?.values.length ?? 0;
  return (
    <div className="rounded-2xl border-2 border-amber-400/40 bg-card/50 p-3 sm:p-4 backdrop-blur shadow-[0_0_30px_rgba(0,0,0,0.4)]">
      <div className="text-center mb-2">
        <div className="text-[9px] uppercase tracking-[0.3em] text-amber-300 font-bold">LCM Ladder</div>
      </div>
      <div className="overflow-hidden rounded-lg border border-primary/30">
        <table className="w-full border-collapse text-center">
          <tbody>
            {rows.map((r, ri) => {
              const isBad = r.status === "bad";
              const isOk = r.status === "ok";
              const divKind = cellReward(ri, -1);
              const divBright = lit && isOk && !!r.divisor;
              return (
                <tr
                  key={ri}
                  className={cn(
                    "animate-fade-in transition-all",
                    isBad && "bg-amber-500/5 ring-2 ring-amber-400/50 ring-inset",
                    isOk && "bg-emerald-500/5",
                  )}
                >
                  {/* Divisor cell */}
                  <td className="border border-primary/20 w-16 p-0 bg-background/30">
                    <button
                      type="button"
                      data-lcm-cell={`${ri}-div`}
                      data-lcm-kind={divKind}
                      onClick={() => onFocus({ rowIdx: ri, col: "div" })}
                      className={cn(
                        "relative w-full px-2 py-3 text-base font-black tabular-nums transition-all min-h-[52px] overflow-hidden",
                        focus?.rowIdx === ri && focus.col === "div" && "bg-amber-400/25 shadow-[inset_0_0_12px_hsl(45_95%_60%/0.6)] ring-2 ring-amber-300 ring-inset",
                      )}
                    >
                      <RewardBg kind={divKind} bright={divBright} />
                      <span
                        className={cn(
                          "relative z-10",
                          r.divisor ? "text-fuchsia-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" : "text-muted-foreground/40",
                        )}
                      >
                        {r.divisor || ""}
                      </span>
                    </button>
                  </td>

                  {/* Number cells */}
                  {Array.from({ length: colCount }).map((_, ci) => {
                    const v = r.values[ci] ?? "";
                    const focused = focus?.rowIdx === ri && focus.col === ci;
                    const isOne = v === "1";
                    const kind = cellReward(ri, ci);
                    const bright = lit && isOk;
                    return (
                      <td key={ci} className="border border-primary/20 p-0">
                        <button
                          type="button"
                          data-lcm-cell={`${ri}-${ci}`}
                          data-lcm-kind={kind}
                          onClick={() => onFocus({ rowIdx: ri, col: ci })}
                          className={cn(
                            "relative w-full px-2 py-3 text-base font-black tabular-nums transition-all min-h-[52px] overflow-hidden",
                            focused && "bg-amber-400/25 shadow-[inset_0_0_12px_hsl(45_95%_60%/0.6)] ring-2 ring-amber-300 ring-inset",
                            !focused && isOne && "bg-emerald-500/10",
                            !focused && !isOne && v && "hover:bg-primary/10",
                            !focused && !v && "hover:bg-primary/5",
                          )}
                        >
                          <RewardBg kind={kind} bright={bright} />
                          <span
                            className={cn(
                              "relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
                              v ? (isOne ? "text-emerald-200" : "text-foreground") : "text-muted-foreground/40",
                            )}
                          >
                            {v || "·"}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Every cell holds a reward — solve the ladder to claim them all.
      </p>
    </div>
  );
};

export default LcmLadder;
