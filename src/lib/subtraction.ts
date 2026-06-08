// Subtraction Borrow Challenge — problem generation.

export type SubDifficulty = "easy" | "medium" | "hard";

export interface SubProblem {
  a: number; // minuend
  b: number; // subtrahend
  diff: number;
  cols: number; // width = digits of minuend
  /** index 0 = units. */
  aDigits: number[];
  bDigits: number[];
  /** Expected answer digits per column (0 = units), length = cols. */
  answerDigits: number[];
  /** True if column p needs a borrow (top digit < bottom digit + carryIn). */
  needsBorrow: boolean[];
}

const rand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const digitsOf = (n: number, w: number) => {
  const out: number[] = [];
  for (let i = 0; i < w; i++) out.push(Math.floor(n / Math.pow(10, i)) % 10);
  return out;
};

const computeBorrows = (a: number, b: number, cols: number) => {
  const ad = digitsOf(a, cols);
  const bd = digitsOf(b, cols);
  const needsBorrow: boolean[] = new Array(cols).fill(false);
  let borrowIn = 0;
  for (let i = 0; i < cols; i++) {
    const top = ad[i] - borrowIn;
    if (top < bd[i]) {
      needsBorrow[i] = true;
      borrowIn = 1;
    } else {
      borrowIn = 0;
    }
  }
  return needsBorrow;
};

const countBorrows = (nb: boolean[]) => nb.filter(Boolean).length;

export const generateProblem = (diff: SubDifficulty): SubProblem => {
  let cols: number;
  let minBorrows: number;
  let maxBorrows: number;
  if (diff === "easy")        { cols = 2; minBorrows = 0; maxBorrows = 0; }
  else if (diff === "medium") { cols = 3; minBorrows = 1; maxBorrows = 2; }
  else                        { cols = rand(4, 4); minBorrows = 2; maxBorrows = 4; }

  let a = 0, b = 0;
  let attempts = 0;
  while (attempts++ < 200) {
    const aMin = Math.pow(10, cols - 1);
    const aMax = Math.pow(10, cols) - 1;
    a = rand(aMin, aMax);
    // b: width up to cols, but at least 2 digits to keep it interesting
    const bWidth = diff === "easy" ? cols : rand(Math.max(2, cols - 1), cols);
    const bMin = Math.pow(10, bWidth - 1);
    const bMax = Math.pow(10, bWidth) - 1;
    b = rand(bMin, Math.min(bMax, a - 1));
    if (b >= a) continue;
    const nb = computeBorrows(a, b, cols);
    const cb = countBorrows(nb);
    if (cb >= minBorrows && cb <= maxBorrows) break;
  }

  const ds = a - b;
  const aDigits = digitsOf(a, cols);
  const bDigits = digitsOf(b, cols);
  const answerDigits = digitsOf(ds, cols);
  const needsBorrow = computeBorrows(a, b, cols);

  return { a, b, diff: ds, cols, aDigits, bDigits, answerDigits, needsBorrow };
};
