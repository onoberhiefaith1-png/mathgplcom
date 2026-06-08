import { cn } from "@/lib/utils";
import { BidmasRewardKind, BIDMAS_REWARD_META } from "@/lib/bidmasRewards";

export interface RowCell {
  symbol: string | null;
  reward: BidmasRewardKind;
  collected: boolean;
}

export interface BoardRow {
  id: number;
  locked: boolean;
  cells: RowCell[];
  shake?: boolean;
  glowOpIdx?: Set<number>;
  /** columns that are currently "transforming out" (collapsing) */
  transformingCols?: Set<number>;
  /** columns that just appeared (pop-in) */
  poppingCols?: Set<number>;
}

interface Props {
  rows: BoardRow[];
  cols: number;
  cursor: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
  showOperatorGlow: boolean;
}

export const EquationBoard = ({ rows, cols, cursor, onCellClick, showOperatorGlow }: Props) => {
  const activeRow = cursor?.row ?? -1;
  return (
    <div className="relative rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-card/85 to-card/50 p-4 sm:p-6 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden">
      {/* faint vertical flow gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-amber-400/[0.025] to-transparent" />
      {/* slow scanline */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent animate-flow-down" />

      <div className="relative max-h-[60vh] overflow-y-auto pr-1 space-y-0">
        {rows.map((row, ri) => {
          const isActive = ri === activeRow && !row.locked;
          const isPast = row.locked;
          const isFuture = !row.locked && ri !== activeRow;
          return (
            <div
              key={row.id}
              data-row-index={ri}
              className={cn(
                "relative flex items-center gap-0 transition-all duration-300",
                row.shake && "animate-[shake_0.4s_ease-in-out]",
                isActive && "bg-amber-400/[0.04] ring-1 ring-amber-400/25 scale-[1.005]",
                isPast && "opacity-80",
                isFuture && "opacity-50",
              )}
            >
              <div className="grid gap-0 flex-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {row.cells.map((cell, ci) => {
                  const isCursor = cursor?.row === ri && cursor?.col === ci;
                  const opGlow = showOperatorGlow && row.glowOpIdx?.has(ci) && cell.symbol && /[+\-×÷^]/.test(cell.symbol);
                  const meta = BIDMAS_REWARD_META[cell.reward];
                  const clickable = !row.locked;
                  const transforming = row.transformingCols?.has(ci);
                  const popping = row.poppingCols?.has(ci);
                  const rewardOpacity = cell.symbol ? "opacity-[0.07]" : isCursor ? "opacity-25" : "opacity-10";
                  return (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => clickable && onCellClick(ri, ci)}
                      data-bidmas-cell={`${ri}-${ci}`}
                      className={cn(
                        "relative flex aspect-square w-full max-w-[52px] items-center justify-center border border-primary/20 -ml-px first:ml-0 transition-all duration-300 select-none",
                        ri > 0 && "-mt-px",
                        "bg-gradient-to-b from-card/90 to-card/60",
                        clickable && "hover:border-amber-300/50 hover:z-[1] cursor-pointer",
                        !clickable && "cursor-default",
                        isCursor && "z-[2] border-amber-400/70 ring-1 ring-amber-300/50 shadow-[0_0_10px_hsl(45_95%_60%/0.4)] scale-[1.04]",
                        opGlow && "z-[2] border-amber-400/60 ring-1 ring-amber-300/50 shadow-[0_0_10px_hsl(45_95%_60%/0.4)] animate-soft-pulse",
                        transforming && "z-[2] animate-collapse-out border-amber-400/70 shadow-[0_0_14px_hsl(45_95%_60%/0.5)]",
                        popping && "z-[2] animate-pop-in border-amber-400/70 shadow-[0_0_14px_hsl(45_95%_60%/0.6)]",
                      )}
                    >
                      {!cell.collected && (
                        <img
                          src={meta.src}
                          alt=""
                          className={cn(
                            "pointer-events-none absolute inset-1 m-auto object-contain transition-opacity duration-300",
                            rewardOpacity,
                          )}
                          draggable={false}
                        />
                      )}
                      {cell.symbol && (
                        <span className={cn(
                          "relative z-10 text-2xl sm:text-3xl font-black tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]",
                          /[+\-×÷^]/.test(cell.symbol) ? "text-rose-200" : "text-white",
                          (cell.symbol === "(" || cell.symbol === ")") && "text-sky-200",
                        )}>
                          {cell.symbol}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
