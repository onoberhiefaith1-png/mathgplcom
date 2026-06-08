import { cn } from "@/lib/utils";
import { DivProblem, DivStage, DivStep } from "@/lib/division";
import { DivRewardKind, DIV_REWARD_META } from "@/lib/divisionRewards";

export interface DivAnswerCell {
  value: number | null;
  reward: DivRewardKind;
  burst: boolean;
  wrong: boolean;
}

export type DivCellKind = "quotient" | "product" | "remainder";

export interface DivBoardState {
  problem: DivProblem;
  stages: DivStage[];
  /** Quotient row by absolute dividend column. */
  quotient: DivAnswerCell[];
  /** Significant product cells per stage, keyed by col. */
  products: Record<number, Record<number, DivAnswerCell>>;
  /** Subtraction-result cells per stage, keyed by col. */
  remainders: Record<number, Record<number, DivAnswerCell>>;
  stepIdx: number;
  totalSteps: number;
  /** Highest stage whose product row is fully revealed (zeros padded). */
  productPadRevealed: number; // -1 = none
  /** Highest stage whose remainder row is fully revealed. */
  remaindersRevealed: number; // -1 = none
}

interface Props {
  state: DivBoardState;
  step: DivStep | null;
  onCellClick: (kind: DivCellKind, stage: number, col: number) => void;
  onCellDrop: (kind: DivCellKind, stage: number, col: number, digit: number) => void;
}

export const DivisionBoard = ({ state, step, onCellClick, onCellDrop }: Props) => {
  const { problem, stages, quotient, products, remainders } = state;
  const cols = problem.nCols;
  const colArr = Array.from({ length: cols }, (_, i) => i);

  const glowQuotientCol = step?.kind === "quotient" ? step.targetCol : null;
  const glowProductCell = step?.kind === "product" ? { stage: step.stage, col: step.targetCol } : null;
  const glowRemCell     = step?.kind === "remainder" ? { stage: step.stage, col: step.targetCol } : null;
  const glowDivisor = !!step;
  const glowWCols = new Set((step?.wCells ?? []).map((c) => c.col));
  const activeStage = step?.stage ?? -1;

  const cellW = "w-9 sm:w-10";
  const cellH = "h-11 sm:h-12";
  // bracket gap (in px-equivalent classes): keep same as "w-3" gap before
  const bracketGapW = "w-3";

  // Total dividend area width in CSS (cols * cell + gaps). Used for the bar in the SVG bracket.
  // We use viewBox math instead.
  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-card/85 to-card/50 p-3 sm:p-5 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
      {/* Quotient row */}
      <div className="flex items-end justify-center gap-1.5">
        <div className={cn("flex items-center justify-center", cellW, cellH)} />
        <div className={cn(bracketGapW)} />
        <div className="flex gap-1.5">
          {colArr.map((c) => {
            const visible = c >= problem.startIdx;
            if (!visible) return <div key={`q-pad-${c}`} className={cn(cellW, cellH)} />;
            const cell = quotient[c];
            const isTarget = glowQuotientCol === c;
            return (
              <div key={`q-${c}`} className="flex justify-center" data-div-cell={`q-${c}`}>
                <AnswerCell
                  cell={cell}
                  isTarget={isTarget}
                  onClick={() => onCellClick("quotient", -1, c)}
                  onDrop={(d) => onCellDrop("quotient", -1, c, d)}
                  className={cn(cellW, cellH)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Divisor + long-division bracket + dividend */}
      <div className="mt-2 flex items-end justify-center gap-1.5">
        <div className={cn("flex items-center justify-center font-black tabular-nums text-3xl sm:text-4xl text-foreground transition-all", cellH,
          glowDivisor ? "text-amber-300 ring-2 ring-amber-300/80 bg-amber-400/10 scale-110 shadow-[0_0_18px_hsl(45_95%_60%/0.7)] rounded-lg px-2" : "px-2")}>
          {problem.divisor}
        </div>

        {/* Hook of long-division bracket (curves up & continues into the vinculum below) */}
        <DivisionHook cellHClass={cellH} />

        <div className="flex gap-1.5 border-t-[3px] border-primary pt-1 -ml-1.5">
        
          {colArr.map((c) => {
            const glow = glowWCols.has(c) && activeStage === 0; // glow only for stage 0 dividend
            return (
              <div key={`d-${c}`} className={cn("flex items-center justify-center transition-all", cellW, cellH,
                glow && "text-amber-300 ring-2 ring-amber-300/70 bg-amber-400/10 rounded-lg shadow-[0_0_14px_hsl(45_95%_60%/0.55)]",
              )}>
                <span className="text-3xl sm:text-4xl font-black tabular-nums">
                  {problem.dDigits[c]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stages: product row, line, remainder row. */}
      <div className="mt-3 flex flex-col items-center gap-2">
        {stages.map((st) => {
          if (st.stage > activeStage) return null;
          const prodCells = products[st.stage] ?? {};
          const remCells = remainders[st.stage] ?? {};
          const padRevealed = st.stage < activeStage || (step?.stage === st.stage && (step.kind === "product" || step.kind === "remainder"));
          const showRemainderRow =
            (step?.kind === "remainder" && step.stage === st.stage) ||
            st.stage <= state.remaindersRevealed ||
            st.stage < activeStage;
          const showResultAsNextW = st.stage < activeStage;

          const isPrevWSource = step ? (step.stage === st.stage + 1) : false;

          return (
            <div key={`stage-${st.stage}`} className="flex flex-col items-center gap-0.5 animate-[scale-in_0.35s_ease-out]">
              {/* Product row */}
              <div className="flex items-center gap-1.5">
                <div className={cn("flex items-center justify-center text-xl font-bold text-rose-400", cellW, cellH)}>
                  −
                </div>
                <div className={cn(bracketGapW)} />
                <div className="flex gap-1.5">
                  {colArr.map((c) => {
                    const sigDef = st.productSigCells.find((p) => p.col === c);
                    const padDef = st.productPadCells.find((p) => p.col === c);
                    const def = sigDef ?? padDef;
                    if (def) {
                      const cell = prodCells[c] ?? { value: null, reward: "coin" as DivRewardKind, burst: false, wrong: false };
                      const isTarget = !!sigDef && glowProductCell?.stage === st.stage && glowProductCell.col === c;
                      const isAuto = !sigDef;
                      return (
                        <div key={`prod-${st.stage}-${c}`} className={cn("flex justify-center", isAuto && "opacity-60")} data-div-cell={`p-${st.stage}-${c}`}>
                          <AnswerCell
                            cell={cell}
                            isTarget={isTarget}
                            onClick={() => !isAuto && onCellClick("product", st.stage, c)}
                            onDrop={(d) => !isAuto && onCellDrop("product", st.stage, c, d)}
                            className={cn(cellW, cellH)}
                          />
                        </div>
                      );
                    }
                    return <div key={`prod-${st.stage}-${c}`} className={cn(cellW, cellH)} />;
                  })}
                </div>
              </div>

              {/* Subtraction line */}
              {padRevealed && (
                <div className="flex items-center gap-1.5">
                  <div className={cn(cellW)} />
                  <div className={cn(bracketGapW)} />
                  <div className="flex gap-1.5">
                    {colArr.map((c) => {
                      const leftMost = st.productSigCells[0]?.col ?? c;
                      const within = c >= leftMost && c < problem.nCols;
                      return (
                        <div key={`ln-${st.stage}-${c}`} className={cn(cellW, "h-[2px]", within ? "bg-gradient-to-r from-amber-300/40 via-amber-300/80 to-amber-300/40 rounded-full" : "")} />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Remainder / subtraction-result row */}
              {showRemainderRow && (
                <div className="flex items-center gap-1.5">
                  <div className={cn(cellW)} />
                  <div className={cn(bracketGapW)} />
                  <div className="flex gap-1.5">
                    {colArr.map((c) => {
                      const rDef = st.remainderCells.find((r) => r.col === c);
                      const aDef = st.remainderAutoCells.find((r) => r.col === c);
                      const def = rDef ?? aDef;
                      if (!def) return <div key={`rem-${st.stage}-${c}`} className={cn(cellW, cellH)} />;
                      const cell = remCells[c] ?? { value: null, reward: "coin" as DivRewardKind, burst: false, wrong: false };
                      const isTarget = !!rDef && glowRemCell?.stage === st.stage && glowRemCell.col === c;
                      const isAuto = !rDef;
                      const filled = cell.value !== null;
                      const sourceGlow = isPrevWSource && filled;
                      return (
                        <div key={`rem-${st.stage}-${c}`} className={cn("flex justify-center", sourceGlow && "ring-2 ring-amber-300/70 rounded-lg", isAuto && "opacity-60")}
                             data-div-cell={`r-${st.stage}-${c}`}>
                          <AnswerCell
                            cell={cell}
                            isTarget={isTarget}
                            onClick={() => !isAuto && onCellClick("remainder", st.stage, c)}
                            onDrop={(d) => !isAuto && onCellDrop("remainder", st.stage, c, d)}
                            className={cn(cellW, cellH)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* (showResultAsNextW retained for future styling) */}
              <span className="hidden">{String(showResultAsNextW)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============= Long-division bracket hook =============
   The horizontal vinculum is the dividend row's border-top, so the hook
   only needs to curve up and meet that border at its top edge with no gap. */

const DivisionHook = ({ cellHClass }: { cellHClass: string }) => {
  return (
    <div className={cn("relative flex items-stretch", cellHClass)} aria-hidden>
      <svg
        viewBox="0 0 12 48"
        preserveAspectRatio="none"
        className="h-full w-3"
      >
        <path
          d="M 3 46 C 3 24, 5 6, 12 1.5"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

/* ============= Cell ============= */

interface CellProps {
  cell: DivAnswerCell;
  isTarget: boolean;
  className?: string;
  onClick: () => void;
  onDrop: (d: number) => void;
}

const AnswerCell = ({ cell, isTarget, className, onClick, onDrop }: CellProps) => {
  const meta = DIV_REWARD_META[cell.reward];
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
        "relative flex items-center justify-center rounded-lg border-2 select-none transition-all",
        "bg-gradient-to-b from-card/90 to-card/60 backdrop-blur-sm border-primary/30",
        isTarget && "border-amber-400 ring-2 ring-amber-300/80 shadow-[0_0_22px_hsl(45_95%_60%/0.85)] scale-105 animate-pulse",
        cell.wrong && "border-rose-500 bg-rose-500/10 animate-[shake_0.4s_ease-in-out]",
        cell.burst && "animate-[scale-in_0.4s_ease-out]",
        className,
      )}
    >
      {cell.value === null && (
        <img
          src={meta.src}
          alt=""
          className={cn(
            "pointer-events-none absolute inset-1 m-auto object-contain transition-opacity",
            isTarget ? "opacity-60" : "opacity-25",
            cell.burst && "opacity-100",
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
