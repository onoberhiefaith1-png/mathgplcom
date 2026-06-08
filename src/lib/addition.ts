// Addition Carry Challenge — problem generation & step planner.

export type AddDifficulty = "easy" | "medium" | "hard";

export interface AddProblem {
  a: number;
  b: number;
  /** Sum (a+b). */
  sum: number;
  /** Width of operand columns (max digits between a and b). */
  operandCols: number;
  /** Width of answer columns (digits of sum). */
  answerCols: number;
  /** Per-column digit of A, index 0 = units. Length = operandCols. */
  aDigits: number[];
  bDigits: number[];
  /** Per-column expected answer digit, index 0 = units. Length = answerCols. */
  answerDigits: number[];
  /** carryInto[c] = carry that goes INTO column c (carryInto[0] is always 0). Length = answerCols. */
  carryInto: number[];
}

const rand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

const digitsOf = (n: number, width: number) => {
  const out: number[] = [];
  for (let i = 0; i < width; i++) {
    out.push(Math.floor(n / Math.pow(10, i)) % 10);
  }
  return out;
};

/** Generate an addition problem that requires at least one carry. */
export const generateProblem = (diff: AddDifficulty): AddProblem => {
  let cols: number;
  if (diff === "easy") cols = 2;
  else if (diff === "medium") cols = 3;
  else cols = rand(4, 4);

  let a = 0;
  let b = 0;
  let attempts = 0;
  // Ensure both operands use the full width AND at least one carry occurs.
  while (attempts++ < 50) {
    const min = Math.pow(10, cols - 1);
    const max = Math.pow(10, cols) - 1;
    a = rand(min, max);
    b = rand(min, max);
    // Has a carry somewhere?
    const ad = digitsOf(a, cols);
    const bd = digitsOf(b, cols);
    let carry = 0;
    let hasCarry = false;
    for (let i = 0; i < cols; i++) {
      const s = ad[i] + bd[i] + carry;
      if (s >= 10) hasCarry = true;
      carry = Math.floor(s / 10);
    }
    if (hasCarry) break;
  }

  const sum = a + b;
  const answerCols = String(sum).length;
  const aDigits = digitsOf(a, cols);
  const bDigits = digitsOf(b, cols);

  const answerDigits: number[] = new Array(answerCols).fill(0);
  const carryInto: number[] = new Array(answerCols).fill(0);
  let carry = 0;
  for (let i = 0; i < answerCols; i++) {
    carryInto[i] = carry;
    const s = (aDigits[i] ?? 0) + (bDigits[i] ?? 0) + carry;
    answerDigits[i] = s % 10;
    carry = Math.floor(s / 10);
  }

  return {
    a, b, sum,
    operandCols: cols,
    answerCols,
    aDigits, bDigits,
    answerDigits, carryInto,
  };
};

/** Cells the player must fill, in pedagogical order (units → up). */
export interface Step {
  type: "answer" | "carry";
  /** Column index, 0 = units. For carry, this is the column the carry GOES INTO. */
  col: number;
  expected: number;
}

export const planSteps = (p: AddProblem): Step[] => {
  const steps: Step[] = [];
  for (let c = 0; c < p.answerCols; c++) {
    // For each column: enter answer digit first, then (if next column gets a carry) enter carry.
    if (c < p.operandCols || p.answerDigits[c] !== 0) {
      // Always require the answer cell for columns inside answer width
    }
    steps.push({ type: "answer", col: c, expected: p.answerDigits[c] });
    if (c + 1 < p.answerCols && p.carryInto[c + 1] > 0) {
      steps.push({ type: "carry", col: c + 1, expected: p.carryInto[c + 1] });
    }
  }
  return steps;
};
