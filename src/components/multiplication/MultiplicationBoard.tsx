import { cn } from "@/lib/utils";
import { MulProblem, MulStep } from "@/lib/multiplication";
import { MulRewardKind, MUL_REWARD_META } from "@/lib/multiplicationRewards";

export type Phase = "multiply" | "sum" | "done";

export interface PartialCell {
  value: number | null;
  reward: MulRewardKind;
  burst: boolean;
  wrong: boolean;
}

export interface SumCell {
  value: number | null;
  reward: MulRewardKind;
  burst: boolean;
  wrong: boolean;
}

export interface MulBoardState {
  problem: MulProblem;
  /** partials[row][col] — col is absolute column (units = 0). Length = problem.cols. */
  partials: PartialCell[][];
  /** sum row, length = problem.cols. Only used in sum phase. */
  sum: SumCell[];
  /** Carry value displayed above the multiplicand for the active row. col → digit. */
  productCarry: Record<number, number>;
  /** Carry value displayed above each absolute column in the sum phase. */
  sumCarry: Record<number, number>;
  /** Active step index. */
  stepIdx: number;
  /** Total steps. */
  totalSteps: number;
  phase: Phase;
}

interface Props {
  state: MulBoardState;
  step: MulStep | null;
  onCellClick: (row: number, col: number) => void;
  onCellDrop: (row: number, col: number, digit: number) => void;
}

export const MultiplicationBoard = ({ state, step, onCellClick, onCellDrop }: Props) => {
  const { problem, partials, sum, productCarry, sumCarry, phase } = state;
  const cols = problem.cols;
  // Display order: leftmost = highest place. We render placeOrder[i] as the absolute column index for the i-th visual cell.
  const placeOrder: number[] = [];
  for (let d = 0; d < cols; d++) placeOrder.push(cols - 1 - d);

  const aLen = problem.aDigits.length;
  const bLen = problem.bDigits.length;

  // Glow lookups
  const glowTopAIdx = step?.kind === "product" ? step.aIdx : null;
  const glowBottomBIdx = step && step.bIdx >= 0 ? step.bIdx : null;
  const glowTargetRow = step?.targetRow ?? null;
  const glowTargetCol = step?.targetCol ?? null;

  // Sum phase column highlight: the active sum target column glows on contributing partial cells too.
  const sumActiveCol = phase === "sum" && step?.kind === "sum" ? step.targetCol : null;

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-card/85 to-card/50 p-3 sm:p-5 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
      {/* Carry row above multiplicand */}
      <div className="grid gap-1.5 items-end" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {placeOrder.map((p) => {
          const c = phase === "multiply" ? productCarry[p] : undefined;
          return (
            <div key={`pc-${p}`} className="flex justify-center h-5">
              {c !== undefined && c > 0 && (
                <div className="flex h-5 w-5 items-center justify-center rounded-md border border-violet-400/70 bg-violet-500/15 text-[11px] font-black text-violet-200 shadow-[0_0_8px_hsl(270_80%_60%/0.6)] animate-[scale-in_0.25s_ease-out]">
                  {c}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Multiplicand */}
      <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {placeOrder.map((p) => {
          const show = p < aLen;
          const glow = show && glowTopAIdx === p;
          return (
            <div key={`a-${p}`} className="flex justify-center">
              {show ? (
                <div className={cn(
                  "flex h-12 w-10 sm:h-14 sm:w-12 items-center justify-center rounded-lg text-3xl sm:text-4xl font-black tabular-nums select-none transition-all",
                  glow ? "text-amber-300 ring-2 ring-amber-300/80 bg-amber-400/10 scale-110 shadow-[0_0_18px_hsl(45_95%_60%/0.7)]" : "text-foreground",
                )}>
                  {problem.aDigits[p]}
                </div>
              ) : <div className="h-12 w-10 sm:h-14 sm:w-12" />}
            </div>
          );
        })}
      </div>

      {/* Multiplier */}
      <div className="mt-3 sm:mt-4 grid gap-1.5 items-center" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
        <div className="flex items-center justify-center text-2xl sm:text-3xl font-black text-primary">×</div>
        {placeOrder.map((p) => {
          const show = p < bLen;
          const glow = show && glowBottomBIdx === p;
          return (
            <div key={`b-${p}`} className="flex justify-center">
              {show ? (
                <div className={cn(
                  "flex h-12 w-10 sm:h-14 sm:w-12 items-center justify-center rounded-lg text-3xl sm:text-4xl font-black tabular-nums select-none transition-all",
                  glow ? "text-amber-300 ring-2 ring-amber-300/80 bg-amber-400/10 scale-110 shadow-[0_0_18px_hsl(45_95%_60%/0.7)]" : "text-foreground",
                )}>
                  {problem.bDigits[p]}
                </div>
              ) : <div className="h-12 w-10 sm:h-14 sm:w-12" />}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="my-3 h-[3px] w-full rounded bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      {/* Partial product rows */}
      {partials.map((row, ri) => {
        // Column visibility: cells from absolute col `ri` up to highest meaningful for this row
        const rowMaxCol = ri + (problem.partialLen[ri] || 0) - 1;
        const rowActive = phase === "multiply" && step?.targetRow === ri;
        return (
          <div key={`row-${ri}`} className="mt-1 grid gap-1.5 items-center" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
            <div className="flex items-center justify-center text-xs font-bold text-muted-foreground">
              {ri > 0 && rowActive && <span className="text-amber-400">+</span>}
            </div>
            {placeOrder.map((p) => {
              const inRange = p >= ri && p <= rowMaxCol;
              if (!inRange) return <div key={`cell-${ri}-${p}`} />;
              const cell = row[p];
              const isTarget = glowTargetRow === ri && glowTargetCol === p && phase === "multiply";
              const sumGlow = sumActiveCol === p && phase === "sum" && cell?.value !== null;
              return (
                <div key={`cell-${ri}-${p}`} className="flex justify-center" data-mul-cell={`p-${ri}-${p}`}>
                  <PartialAnswerCell
                    cell={cell!}
                    isTarget={isTarget}
                    sumGlow={sumGlow}
                    onClick={() => onCellClick(ri, p)}
                    onDrop={(d) => onCellDrop(ri, p, d)}
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Sum phase: divider + carry row + sum row */}
      {phase !== "multiply" && (
        <>
          <div className="my-3 h-[3px] w-full rounded bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

          {/* Sum carries */}
          <div className="grid gap-1.5 items-end" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
            <div />
            {placeOrder.map((p) => {
              const c = sumCarry[p];
              return (
                <div key={`sc-${p}`} className="flex justify-center h-5">
                  {c !== undefined && c > 0 && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-md border border-violet-400/70 bg-violet-500/15 text-[11px] font-black text-violet-200 shadow-[0_0_8px_hsl(270_80%_60%/0.6)] animate-[scale-in_0.25s_ease-out]">
                      {c}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sum row */}
          <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
            <div className="flex items-center justify-center text-2xl sm:text-3xl font-black text-emerald-400">=</div>
            {placeOrder.map((p) => {
              const isTarget = phase === "sum" && glowTargetCol === p;
              return (
                <div key={`sum-${p}`} className="flex justify-center" data-mul-cell={`s-${p}`}>
                  <PartialAnswerCell
                    cell={sum[p]}
                    isTarget={isTarget}
                    sumGlow={false}
                    onClick={() => onCellClick(-1, p)}
                    onDrop={(d) => onCellDrop(-1, p, d)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/* ========== Cell ========== */

interface CellProps {
  cell: PartialCell;
  isTarget: boolean;
  sumGlow: boolean;
  onClick: () => void;
  onDrop: (d: number) => void;
}

const PartialAnswerCell = ({ cell, isTarget, sumGlow, onClick, onDrop }: CellProps) => {
  const meta = MUL_REWARD_META[cell.reward];
  const handleOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const n = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(n)) onDrop(n);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={handleOver}
      onDrop={handleDrop}
      className={cn(
        "relative flex h-12 w-10 sm:h-14 sm:w-12 items-center justify-center rounded-lg border-2 select-none transition-all",
        "bg-gradient-to-b from-card/90 to-card/60 backdrop-blur-sm border-primary/30",
        isTarget && "border-amber-400 ring-2 ring-amber-300/80 shadow-[0_0_22px_hsl(45_95%_60%/0.85)] scale-105 animate-pulse",
        sumGlow && "border-sky-400/70 ring-2 ring-sky-300/60 shadow-[0_0_14px_hsl(200_80%_60%/0.7)]",
        cell.wrong && "border-rose-500 bg-rose-500/10 animate-[shake_0.4s_ease-in-out]",
        cell.burst && "animate-[scale-in_0.4s_ease-out]",
      )}
    >
      {cell.value === null && (
        <img
          src={meta.src}
          alt=""
          className={cn(
            "pointer-events-none absolute inset-1 m-auto object-contain transition-opacity",
            isTarget ? "opacity-60" : "opacity-25",
            cell.burst && "opacity-100 drop-shadow-[0_0_6px_currentColor]",
          )}
          draggable={false}
        />
      )}
      {cell.burst && (
        <span className="absolute -inset-1 rounded-lg ring-2 ring-amber-300/70 shadow-[0_0_18px_hsl(45_95%_60%/0.8)] animate-[scale-in_0.3s_ease-out]" />
      )}
      {cell.value !== null && (
        <span className="relative z-10 text-2xl sm:text-3xl font-black tabular-nums text-foreground drop-shadow">
          {cell.value}
        </span>
      )}
    </button>
  );
};
