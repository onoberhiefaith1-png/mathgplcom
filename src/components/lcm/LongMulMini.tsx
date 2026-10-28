import { useEffect, useMemo, useState } from "react";
import { MulProblem, MulStep, buildSteps } from "@/lib/multiplication";
import { pickMulReward } from "@/lib/multiplicationRewards";
import { MultiplicationBoard, MulBoardState, PartialCell, SumCell, Phase } from "@/components/multiplication/MultiplicationBoard";
import { DigitBank } from "@/components/multiplication/DigitBank";

const digitsOf = (n: number, w: number) => {
  const out: number[] = [];
  for (let i = 0; i < w; i++) out.push(Math.floor(n / Math.pow(10, i)) % 10);
  return out;
};
const trimLen = (digits: number[]) => {
  let len = digits.length;
  while (len > 1 && digits[len - 1] === 0) len--;
  return len;
};

const buildProblem = (a: number, b: number): MulProblem => {
  const aLen = Math.max(1, String(a).length);
  const bLen = Math.max(1, String(b).length);
  const aDigits = digitsOf(a, aLen);
  const bDigits = digitsOf(b, bLen);
  const partialDigits: number[][] = [];
  const partialLen: number[] = [];
  for (let mi = 0; mi < bLen; mi++) {
    const bd = bDigits[mi];
    const row = new Array(aLen + 1).fill(0);
    let carry = 0;
    for (let ai = 0; ai < aLen; ai++) {
      const p = aDigits[ai] * bd + carry;
      row[ai] = p % 10;
      carry = Math.floor(p / 10);
    }
    row[aLen] = carry;
    partialDigits.push(row);
    partialLen.push(trimLen(row));
  }
  const product = a * b;
  let sumWidth = 1;
  for (let mi = 0; mi < bLen; mi++) sumWidth = Math.max(sumWidth, mi + partialLen[mi]);
  sumWidth = Math.max(sumWidth, String(product).length);
  const sumDigits = digitsOf(product, sumWidth + 1);
  const sumLen = trimLen(sumDigits);
  const cols = Math.max(sumLen, sumWidth);
  return { a, b, product, aDigits, bDigits, rows: bLen, cols, partialDigits, partialLen, sumDigits: sumDigits.slice(0, cols), sumLen };
};

const buildBoard = (p: MulProblem): MulBoardState => {
  const partials: PartialCell[][] = [];
  for (let r = 0; r < p.rows; r++) {
    const row: PartialCell[] = [];
    for (let c = 0; c < p.cols; c++) row.push({ value: null, reward: pickMulReward(), burst: false, wrong: false });
    partials.push(row);
  }
  const sum: SumCell[] = [];
  for (let c = 0; c < p.cols; c++) sum.push({ value: null, reward: pickMulReward(), burst: false, wrong: false });
  const steps = buildSteps(p);
  return { problem: p, partials, sum, productCarry: {}, sumCarry: {}, stepIdx: 0, totalSteps: steps.length, phase: "multiply" };
};

interface Props {
  a: number;
  b: number;
  /** Called when student fully solves the multiplication. */
  onSolved: (product: number) => void;
}

export const LongMulMini = ({ a, b, onSolved }: Props) => {
  const problem = useMemo(() => buildProblem(a, b), [a, b]);
  const steps = useMemo(() => buildSteps(problem), [problem]);
  const [board, setBoard] = useState<MulBoardState>(() => buildBoard(problem));
  const [solvedFlag, setSolvedFlag] = useState(false);

  useEffect(() => {
    setBoard(buildBoard(problem));
    setSolvedFlag(false);
  }, [problem]);

  const currentStep: MulStep | null = board.stepIdx < steps.length ? steps[board.stepIdx] : null;

  // Trivial single-step (single-digit × single-digit < 10)
  useEffect(() => {
    if (steps.length === 0 && !solvedFlag) {
      setSolvedFlag(true);
      setTimeout(() => onSolved(problem.product), 300);
    }
  }, [steps, solvedFlag, problem, onSolved]);

  const advanceStep = (b0: MulBoardState): MulBoardState => {
    const nextIdx = b0.stepIdx + 1;
    let phase: Phase = b0.phase;
    let productCarry: Record<number, number> = {};
    let sumCarry = { ...b0.sumCarry };
    const next = nextIdx < steps.length ? steps[nextIdx] : null;
    if (next) {
      if (next.kind === "product" && next.carryIn > 0 && next.aIdx !== null) {
        productCarry = { [next.aIdx]: next.carryIn };
      } else if (next.kind === "sum") {
        productCarry = {};
        if (next.carryIn > 0) sumCarry = { ...sumCarry, [next.targetCol]: next.carryIn };
      }
      if (next.kind === "sum" && b0.phase === "multiply") phase = "sum";
    } else {
      productCarry = {};
      phase = "done";
    }
    return { ...b0, stepIdx: nextIdx, phase, productCarry, sumCarry };
  };

  const flashWrong = (row: number, col: number) => {
    setBoard((prev) => {
      if (row === -1) {
        const sum = prev.sum.map((c, i) => (i === col ? { ...c, wrong: true } : c));
        return { ...prev, sum };
      }
      const partials = prev.partials.map((r, ri) => (ri === row ? r.map((c, i) => (i === col ? { ...c, wrong: true } : c)) : r));
      return { ...prev, partials };
    });
    setTimeout(() => {
      setBoard((prev) => {
        if (row === -1) {
          const sum = prev.sum.map((c, i) => (i === col ? { ...c, wrong: false } : c));
          return { ...prev, sum };
        }
        const partials = prev.partials.map((r, ri) => (ri === row ? r.map((c, i) => (i === col ? { ...c, wrong: false } : c)) : r));
        return { ...prev, partials };
      });
    }, 450);
  };

  const placeDigit = (row: number, col: number, digit: number) => {
    if (solvedFlag) return;
    const step = currentStep;
    if (!step) return;
    if (row !== step.targetRow || col !== step.targetCol) { flashWrong(row, col); return; }
    if (digit !== step.expectedDigit) { flashWrong(row, col); return; }

    setBoard((prev) => {
      let next = prev;
      if (row === -1) {
        const sum = prev.sum.map((c, i) => (i === col ? { ...c, value: digit, burst: true, wrong: false } : c));
        next = { ...prev, sum };
      } else {
        const partials = prev.partials.map((r, ri) => (ri === row ? r.map((c, i) => (i === col ? { ...c, value: digit, burst: true, wrong: false } : c)) : r));
        next = { ...prev, partials };
      }
      next = advanceStep(next);
      if (next.stepIdx >= steps.length && !solvedFlag) {
        setSolvedFlag(true);
        setTimeout(() => onSolved(problem.product), 500);
      }
      return next;
    });

    setTimeout(() => {
      setBoard((prev) => {
        if (row === -1) {
          const sum = prev.sum.map((c, i) => (i === col ? { ...c, burst: false } : c));
          return { ...prev, sum };
        }
        const partials = prev.partials.map((r, ri) => (ri === row ? r.map((c, i) => (i === col ? { ...c, burst: false } : c)) : r));
        return { ...prev, partials };
      });
    }, 600);
  };

  return (
    <div className="rounded-2xl border-2 border-sky-400/40 bg-card/50 p-3 backdrop-blur shadow-[0_0_30px_rgba(0,0,0,0.4)]">
      <div className="text-center mb-2">
        <div className="text-[9px] uppercase tracking-[0.3em] text-sky-300 font-bold">Long Multiplication</div>
        <div className="text-xs text-muted-foreground">Solve {a} × {b}</div>
      </div>
      <MultiplicationBoard
        state={board}
        step={currentStep}
        onCellClick={() => {}}
        onCellDrop={(r, c, d) => placeDigit(r, c, d)}
      />
      <div className="mt-3">
        <DigitBank onPick={(d) => {
          const step = currentStep;
          if (step) placeDigit(step.targetRow, step.targetCol, d);
        }} />
      </div>
    </div>
  );
};

export default LongMulMini;
