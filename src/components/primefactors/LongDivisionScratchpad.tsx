import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buildStages, buildSteps, DivProblem, DivStage, DivStep } from "@/lib/division";
import { pickDivReward } from "@/lib/divisionRewards";
import { DivisionBoard, DivBoardState, DivAnswerCell, DivCellKind } from "@/components/division/DivisionBoard";
import { DigitBank } from "@/components/division/DigitBank";
import { DivRewardKind } from "@/lib/divisionRewards";

interface Props {
  dividend: number;
  divisor: number | null;
  /** Fires once when the long division is fully solved. Auto-clears afterwards. */
  onSolved: (quotient: number) => void;
  /** Fires whenever a correct digit is placed — use to fly a coin/reward to the wallet. */
  onDigitCorrect?: (pos: { x: number; y: number }, kind: DivRewardKind) => void;
}

const newCell = (): DivAnswerCell => ({ value: null, reward: pickDivReward(), burst: false, wrong: false });

const buildSeedProblem = (dividend: number, divisor: number): DivProblem | null => {
  if (!Number.isFinite(dividend) || !Number.isFinite(divisor)) return null;
  if (divisor < 2 || dividend < divisor) return null;
  const dDigits = String(dividend).split("").map(Number);
  const sDigits = String(divisor).split("").map(Number);
  let startIdx = 0;
  let prefixVal = dDigits[0];
  while (prefixVal < divisor && startIdx < dDigits.length - 1) {
    startIdx++;
    prefixVal = prefixVal * 10 + dDigits[startIdx];
  }
  const quotient = Math.floor(dividend / divisor);
  const remainder = dividend - quotient * divisor;
  return { dividend, divisor, quotient, remainder, dDigits, sDigits, nCols: dDigits.length, startIdx };
};

const buildBoard = (p: DivProblem): { board: DivBoardState; stages: DivStage[]; steps: DivStep[] } => {
  const stages = buildStages(p);
  const steps = buildSteps(p, stages);
  const quotient: DivAnswerCell[] = Array.from({ length: p.nCols }, () => newCell());
  const products: Record<number, Record<number, DivAnswerCell>> = {};
  const remainders: Record<number, Record<number, DivAnswerCell>> = {};
  for (const st of stages) {
    products[st.stage] = {};
    for (const cell of st.productSigCells) products[st.stage][cell.col] = newCell();
    for (const cell of st.productPadCells) products[st.stage][cell.col] = newCell();
    remainders[st.stage] = {};
    for (const cell of st.remainderCells) remainders[st.stage][cell.col] = newCell();
    for (const cell of st.remainderAutoCells) remainders[st.stage][cell.col] = newCell();
  }
  return {
    board: {
      problem: p, stages, quotient, products, remainders,
      stepIdx: 0, totalSteps: steps.length,
      productPadRevealed: -1, remaindersRevealed: -1,
    },
    stages, steps,
  };
};

export const LongDivisionScratchpad = ({ dividend, divisor, onSolved, onDigitCorrect }: Props) => {
  const problem = useMemo(() => (divisor ? buildSeedProblem(dividend, divisor) : null), [dividend, divisor]);
  const built = useMemo(() => (problem ? buildBoard(problem) : null), [problem]);
  const [board, setBoard] = useState<DivBoardState | null>(built?.board ?? null);
  const stepsRef = useRef<DivStep[]>(built?.steps ?? []);
  const firedRef = useRef(false);
  const boardRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBoard(built?.board ?? null);
    stepsRef.current = built?.steps ?? [];
    firedRef.current = false;
  }, [built]);

  const currentStep: DivStep | null = board && board.stepIdx < stepsRef.current.length ? stepsRef.current[board.stepIdx] : null;

  const flashWrong = (kind: DivCellKind, stage: number, col: number) => {
    setBoard((prev) => {
      if (!prev) return prev;
      const apply = (c: DivAnswerCell): DivAnswerCell => ({ ...c, wrong: true });
      const clear = (c: DivAnswerCell): DivAnswerCell => ({ ...c, wrong: false });
      let next = prev;
      if (kind === "quotient") next = { ...prev, quotient: prev.quotient.map((c, i) => i === col ? apply(c) : c) };
      else if (kind === "product") {
        const sm = { ...(prev.products[stage] ?? {}) };
        if (sm[col]) sm[col] = apply(sm[col]);
        next = { ...prev, products: { ...prev.products, [stage]: sm } };
      } else {
        const sm = { ...(prev.remainders[stage] ?? {}) };
        if (sm[col]) sm[col] = apply(sm[col]);
        next = { ...prev, remainders: { ...prev.remainders, [stage]: sm } };
      }
      setTimeout(() => setBoard((p) => {
        if (!p) return p;
        if (kind === "quotient") return { ...p, quotient: p.quotient.map((c, i) => i === col ? clear(c) : c) };
        if (kind === "product") {
          const sm = { ...(p.products[stage] ?? {}) };
          if (sm[col]) sm[col] = clear(sm[col]);
          return { ...p, products: { ...p.products, [stage]: sm } };
        }
        const sm = { ...(p.remainders[stage] ?? {}) };
        if (sm[col]) sm[col] = clear(sm[col]);
        return { ...p, remainders: { ...p.remainders, [stage]: sm } };
      }), 400);
      return next;
    });
  };

  const placeDigit = (kind: DivCellKind, stage: number, col: number, digit: number) => {
    if (!board) return;
    const step = currentStep;
    if (!step) return;
    const matchesTarget = step.kind === kind &&
      (kind === "quotient" ? col === step.targetCol : (stage === step.stage && col === step.targetCol));
    if (!matchesTarget) { flashWrong(kind, stage, col); return; }
    if (digit !== step.expectedDigit) { flashWrong(kind, stage, col); return; }

    let placedCellReward: DivRewardKind = "coin";
    setBoard((prev) => {
      if (!prev) return prev;
      let next = { ...prev };
      if (kind === "quotient") {
        placedCellReward = prev.quotient[col]?.reward ?? "coin";
        next.quotient = prev.quotient.map((c, i) => i === col ? { ...c, value: digit, burst: true, wrong: false } : c);
      } else if (kind === "product") {
        const sm = { ...(prev.products[step.stage] ?? {}) };
        placedCellReward = sm[col]?.reward ?? "coin";
        sm[col] = { ...sm[col], value: digit, burst: true, wrong: false };
        if ((step.prodDigitIdx ?? 0) + 1 >= (step.prodTotalDigits ?? 1)) {
          const stageDef = prev.stages[step.stage];
          for (const padC of stageDef.productPadCells) sm[padC.col] = { ...(sm[padC.col] ?? newCell()), value: padC.digit };
          const sr = { ...(prev.remainders[step.stage] ?? {}) };
          for (const rc of stageDef.remainderAutoCells) sr[rc.col] = { ...(sr[rc.col] ?? newCell()), value: rc.digit };
          next.products = { ...prev.products, [step.stage]: sm };
          next.remainders = { ...prev.remainders, [step.stage]: sr };
          next.productPadRevealed = Math.max(prev.productPadRevealed, step.stage);
        } else {
          next.products = { ...prev.products, [step.stage]: sm };
        }
      } else {
        const sm = { ...(prev.remainders[step.stage] ?? {}) };
        placedCellReward = sm[col]?.reward ?? "coin";
        sm[col] = { ...sm[col], value: digit, burst: true, wrong: false };
        next.remainders = { ...prev.remainders, [step.stage]: sm };
        if ((step.remDigitIdx ?? 0) + 1 >= (step.remTotalDigits ?? 1)) {
          next.remaindersRevealed = Math.max(prev.remaindersRevealed, step.stage);
        }
      }
      next.stepIdx = prev.stepIdx + 1;
      return next;
    });

    // Fly reward to wallet from this cell
    if (onDigitCorrect) {
      const sel = kind === "quotient" ? `[data-div-cell="q-${col}"]`
        : kind === "product" ? `[data-div-cell="p-${step.stage}-${col}"]`
        : `[data-div-cell="r-${step.stage}-${col}"]`;
      const el = boardRootRef.current?.querySelector(sel) as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      if (r) onDigitCorrect({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, placedCellReward);
    }

    setTimeout(() => {
      setBoard((prev) => {
        if (!prev) return prev;
        const clear = (c: DivAnswerCell): DivAnswerCell => ({ ...c, burst: false });
        if (kind === "quotient") return { ...prev, quotient: prev.quotient.map((c, i) => i === col ? clear(c) : c) };
        if (kind === "product") {
          const sm = { ...(prev.products[stage] ?? {}) };
          if (sm[col]) sm[col] = clear(sm[col]);
          return { ...prev, products: { ...prev.products, [stage]: sm } };
        }
        const sm = { ...(prev.remainders[stage] ?? {}) };
        if (sm[col]) sm[col] = clear(sm[col]);
        return { ...prev, remainders: { ...prev.remainders, [stage]: sm } };
      });
    }, 600);
  };

  // Detect solved → fire onSolved exactly once
  useEffect(() => {
    if (!board || !problem || firedRef.current) return;
    if (board.stepIdx >= stepsRef.current.length) {
      firedRef.current = true;
      const q = problem.quotient;
      setTimeout(() => onSolved(q), 450);
    }
  }, [board, problem, onSolved]);

  const handleBankPick = (digit: number) => {
    const step = currentStep;
    if (!step) return;
    placeDigit(step.kind, step.stage, step.targetCol, digit);
  };

  // Empty / placeholder state
  if (!divisor || !board || !problem) {
    return (
      <div className="rounded-2xl border-2 border-emerald-500/40 bg-card/60 p-3 sm:p-4 backdrop-blur shadow-[0_0_24px_hsl(150_70%_50%/0.18)] min-h-[260px]">
        <h2 className="text-center text-sm sm:text-base font-black uppercase tracking-[0.25em] text-emerald-300 mb-3">
          Division Workspace
        </h2>
        <div className="flex flex-col items-center justify-center gap-2 py-8">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-muted-foreground/60">?</span>
            <span className="text-3xl font-black text-foreground/80">)</span>
            <span className="text-4xl font-black tabular-nums text-amber-200 drop-shadow-[0_0_10px_hsl(45_95%_60%/0.5)]">
              {dividend}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground text-center max-w-xs">
            Tap a <span className="text-cyan-300 font-bold">prime</span> below to start dividing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-500/40 bg-card/60 p-3 backdrop-blur shadow-[0_0_24px_hsl(150_70%_50%/0.18)] space-y-2">
      <h2 className="text-center text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
        Division Workspace
      </h2>
      <div className="text-center text-[11px] font-bold tabular-nums">
        <span className="text-emerald-300">{divisor}</span>
        <span className="text-muted-foreground"> ) </span>
        <span className="text-amber-200">{dividend}</span>
      </div>

      <div ref={boardRootRef} className="overflow-x-auto rounded-md bg-background/30 p-2 border border-primary/20">
        <DivisionBoard
          state={board}
          step={currentStep}
          onCellClick={() => {}}
          onCellDrop={(kind, stage, col, digit) => placeDigit(kind, stage, col, digit)}
        />
      </div>

      <DigitBank onPick={handleBankPick} />
    </div>
  );
};
