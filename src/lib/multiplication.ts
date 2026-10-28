// Long Multiplication Builder — problem & step engine.

export type MulDifficulty = "easy" | "medium" | "hard" | "expert";

export interface MulProblem {
  a: number;
  b: number;
  product: number;
  /** units-first digit arrays */
  aDigits: number[];
  bDigits: number[];
  /** number of partial-product rows = bDigits.length */
  rows: number;
  /** absolute column count for the board (max of partial products + final sum) */
  cols: number;
  /** Digits of each partial product (units-first). Length = aDigits.length + 1 to fit a possible final carry. Padded with 0s in unused slots. */
  partialDigits: number[][];
  /** Effective length per row (no leading zeros beyond meaningful). */
  partialLen: number[];
  /** Digits of the final sum (units-first). Length = cols. */
  sumDigits: number[];
  /** Length of meaningful sum digits. */
  sumLen: number;
}

export type MulStepKind = "product" | "finalCarry" | "sum";

export interface MulStep {
  kind: MulStepKind;
  /** Multiplier digit index (units = 0). For all multiplication-phase steps. */
  bIdx: number;
  /** Multiplicand digit index (units = 0) being multiplied. For "product" only. */
  aIdx: number | null;
  /** Row in the partial-product area. -1 for sum. */
  targetRow: number;
  /** Absolute column (units = 0) of the cell to fill. */
  targetCol: number;
  /** Expected digit to place. */
  expectedDigit: number;
  /** Carry-in for the operation (display above current aIdx column when > 0). For "product" only. */
  carryIn: number;
  /** Carry-out of this step (informational). */
  carryOut: number;
  /** Sum-phase: digits being added in this column (visual hints). */
  sumSources?: { row: number; col: number; digit: number }[];
}

const rand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
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

const sizesFor = (d: MulDifficulty): { aLen: number; bLen: number } => {
  switch (d) {
    case "easy":   return { aLen: 2, bLen: 1 };
    case "medium": return { aLen: 2, bLen: 2 };
    case "hard":   return { aLen: 3, bLen: 2 };
    case "expert": return { aLen: 3, bLen: 3 };
  }
};

export const generateProblem = (diff: MulDifficulty): MulProblem => {
  const { aLen, bLen } = sizesFor(diff);
  // Avoid trivial 1-digit answers; require at least one carry across rows for medium+.
  let attempts = 0;
  let a = 0, b = 0;
  while (attempts++ < 200) {
    const aMin = Math.pow(10, aLen - 1);
    const aMax = Math.pow(10, aLen) - 1;
    const bMin = Math.pow(10, bLen - 1);
    const bMax = Math.pow(10, bLen) - 1;
    a = rand(aMin, aMax);
    b = rand(bMin, bMax);
    if (a < 11 || b < 2) continue;
    if (diff !== "easy") {
      // Encourage at least one carry inside any partial product.
      const bd = digitsOf(b, bLen);
      const ad = digitsOf(a, aLen);
      let hasCarry = false;
      for (const bdg of bd) {
        if (bdg === 0) continue;
        let c = 0;
        for (let i = 0; i < aLen; i++) {
          const p = ad[i] * bdg + c;
          if (p >= 10 && i < aLen - 1) { hasCarry = true; }
          c = Math.floor(p / 10);
        }
      }
      if (!hasCarry) continue;
    }
    break;
  }

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
  // Sum width = highest non-zero column + 1
  let sumWidth = 1;
  for (let mi = 0; mi < bLen; mi++) {
    sumWidth = Math.max(sumWidth, mi + partialLen[mi]);
  }
  // Final answer column count must fit product
  sumWidth = Math.max(sumWidth, String(product).length);
  const sumDigits = digitsOf(product, sumWidth + 1);
  const sumLen = trimLen(sumDigits);

  const cols = Math.max(sumLen, sumWidth);

  return { a, b, product, aDigits, bDigits, rows: bLen, cols, partialDigits, partialLen, sumDigits: sumDigits.slice(0, cols), sumLen };
};

/* ---------- Step engine ---------- */

export const buildSteps = (p: MulProblem): MulStep[] => {
  const steps: MulStep[] = [];
  const aLen = p.aDigits.length;

  // Multiplication phase
  for (let mi = 0; mi < p.bDigits.length; mi++) {
    const bd = p.bDigits[mi];
    if (bd === 0) {
      // Skip zero multiplier rows entirely (no partial product to enter).
      continue;
    }
    let carry = 0;
    for (let ai = 0; ai < aLen; ai++) {
      const prod = p.aDigits[ai] * bd + carry;
      const digit = prod % 10;
      const carryOut = Math.floor(prod / 10);
      steps.push({
        kind: "product",
        bIdx: mi,
        aIdx: ai,
        targetRow: mi,
        targetCol: ai + mi,
        expectedDigit: digit,
        carryIn: carry,
        carryOut,
      });
      carry = carryOut;
    }
    if (carry > 0) {
      steps.push({
        kind: "finalCarry",
        bIdx: mi,
        aIdx: null,
        targetRow: mi,
        targetCol: aLen + mi,
        expectedDigit: carry,
        carryIn: carry,
        carryOut: 0,
      });
    }
  }

  // Sum phase — column by column, units first
  if (p.bDigits.filter((d) => d !== 0).length > 1) {
    let carry = 0;
    for (let c = 0; c < p.sumLen; c++) {
      // gather contributing partial digits in this column
      const sources: { row: number; col: number; digit: number }[] = [];
      for (let mi = 0; mi < p.bDigits.length; mi++) {
        const localCol = c - mi;
        if (localCol < 0 || localCol >= p.partialLen[mi]) continue;
        sources.push({ row: mi, col: c, digit: p.partialDigits[mi][localCol] });
      }
      const total = sources.reduce((s, x) => s + x.digit, 0) + carry;
      const digit = total % 10;
      const carryOut = Math.floor(total / 10);
      steps.push({
        kind: "sum",
        bIdx: -1,
        aIdx: null,
        targetRow: -1,
        targetCol: c,
        expectedDigit: digit,
        carryIn: carry,
        carryOut,
        sumSources: sources,
      });
      carry = carryOut;
    }
    if (carry > 0) {
      steps.push({
        kind: "sum",
        bIdx: -1,
        aIdx: null,
        targetRow: -1,
        targetCol: p.sumLen,
        expectedDigit: carry,
        carryIn: carry,
        carryOut: 0,
        sumSources: [],
      });
    }
  }

  return steps;
};
