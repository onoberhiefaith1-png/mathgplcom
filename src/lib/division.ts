// Long Division Builder — paper-style with auto-padded zeros (partial quotients style).
//
// Each stage operates on a FULL-WIDTH remaining row W (stage 0 = dividend).
//   1. Determine windowVal = leading digits of W up to colP.
//   2. QUOTIENT digit q at colP = floor(windowVal / divisor).
//   3. SIGNIFICANT product = q * divisor (1+ digits), right-aligned at colP.
//      Trailing zeros (cols colP+1 .. nCols-1) are AUTO-FILLED by the UI.
//   4. PADDED product = product * 10^(nCols-1-colP).
//   5. RESULT row = W - paddedProduct, displayed full width (with leading zeros).
//      Student types each digit of the result row left→right (auto-skipped if equal
//      to W's digit AND to the left of any changed column — i.e. unchanged carry-downs
//      to the LEFT of the subtraction zone are auto-filled).
//
// Next stage: W := result row value, colP advances by 1.

export type DivDifficulty = "easy" | "medium" | "hard" | "expert";

export interface DivProblem {
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  dDigits: number[];
  sDigits: number[];
  nCols: number;
  /** First quotient column (skip leading zeros of the quotient). */
  startIdx: number;
}

export type DivStepKind = "quotient" | "product" | "remainder";

export interface DivStep {
  stage: number;
  kind: DivStepKind;
  colP: number;
  /** All cells of W (the full-width row being subtracted from). */
  wCells: { col: number; digit: number }[];
  targetCol: number;
  expectedDigit: number;

  /** The window value actually divided this stage (leading digits of W up to colP). */
  windowVal: number;
  q: number;
  /** Significant product = q * divisor. */
  product: number;
  /** Padded product (full nCols-wide value) = product * 10^(nCols-1-colP). */
  paddedProduct: number;
  /** Result row value = W - paddedProduct. */
  resultValue: number;

  prodDigitIdx?: number;
  prodTotalDigits?: number;

  remDigitIdx?: number;
  remTotalDigits?: number;
}

export interface DivStage {
  stage: number;
  /** Quotient column. */
  colP: number;
  /** Full-width starting row for this stage. */
  W: number;
  wCells: { col: number; digit: number }[];

  windowVal: number;
  q: number;
  product: number;
  paddedProduct: number;
  resultValue: number;

  /** Significant product digits, right-aligned ending at colP. */
  productSigCells: { col: number; digit: number }[];
  /** Auto-filled trailing zeros of the product, cols colP+1 .. nCols-1. */
  productPadCells: { col: number; digit: number }[];
  /** Result-row digits the STUDENT must type (left→right, from leftmost changed col to nCols-1). */
  remainderCells: { col: number; digit: number }[];
  /** Result-row digits AUTO-filled (unchanged carry-downs to the left of the subtraction zone). */
  remainderAutoCells: { col: number; digit: number }[];
}

const rand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const digitsLR = (n: number): number[] => String(n).split("").map(Number);

const sizesFor = (d: DivDifficulty) => {
  switch (d) {
    case "easy":   return { dMin: 12,    dMax: 99,    sMin: 2,  sMax: 9,  allowRem: false };
    case "medium": return { dMin: 100,   dMax: 999,   sMin: 2,  sMax: 9,  allowRem: false };
    case "hard":   return { dMin: 1000,  dMax: 9999,  sMin: 2,  sMax: 9,  allowRem: false };
    case "expert": return { dMin: 1000,  dMax: 99999, sMin: 11, sMax: 49, allowRem: false };
  }
};

export const generateProblem = (diff: DivDifficulty): DivProblem => {
  const { dMin, dMax, sMin, sMax, allowRem } = sizesFor(diff);
  let dividend = 0, divisor = 0, attempts = 0;
  while (attempts++ < 400) {
    divisor = rand(sMin, sMax);
    dividend = rand(dMin, dMax);
    if (divisor < 2) continue;
    if (dividend < divisor * 2) continue;
    if (!allowRem && dividend % divisor !== 0) continue;
    if (allowRem && dividend % divisor === 0 && Math.random() < 0.6) continue;
    break;
  }
  const dDigits = digitsLR(dividend);
  const sDigits = digitsLR(divisor);

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

/* ---------- Stage / Step engine ---------- */

const valueToCells = (value: number, rightCol: number, minWidth = 1): { col: number; digit: number }[] => {
  const ds = value === 0 ? [0] : digitsLR(value);
  const width = Math.max(ds.length, minWidth);
  const padded = Array(width - ds.length).fill(0).concat(ds);
  return padded.map((d, idx) => ({ col: rightCol - (padded.length - 1 - idx), digit: d }));
};

/** Pad an integer to a fixed nCols-wide digit array (leading zeros). */
const toFullDigits = (value: number, nCols: number): number[] => {
  const ds = digitsLR(value);
  if (ds.length >= nCols) return ds.slice(-nCols);
  return Array(nCols - ds.length).fill(0).concat(ds);
};

export const buildStages = (p: DivProblem): DivStage[] => {
  const stages: DivStage[] = [];
  let W = p.dividend;

  for (let i = p.startIdx; i < p.nCols; i++) {
    const stage = stages.length;
    const colP = i;
    const padPow = p.nCols - 1 - colP;

    const wDigits = toFullDigits(W, p.nCols);
    const wCells = wDigits.map((d, c) => ({ col: c, digit: d }));

    // Window = leading digits of W up to colP (inclusive). For W with leading zeros,
    // those zeros contribute (so e.g. W=043 colP=1 → window=04=4).
    let windowVal = 0;
    for (let c = 0; c <= colP; c++) windowVal = windowVal * 10 + wDigits[c];

    const q = Math.floor(windowVal / p.divisor);
    const product = q * p.divisor;
    const paddedProduct = product * Math.pow(10, padPow);
    const resultValue = W - paddedProduct;

    const productSigCells = valueToCells(product, colP, 1);
    const productPadCells: { col: number; digit: number }[] = [];
    for (let c = colP + 1; c < p.nCols; c++) productPadCells.push({ col: c, digit: 0 });

    const resultDigits = toFullDigits(resultValue, p.nCols);

    let firstChanged = p.nCols;
    if (q !== 0) {
      const leftmostSigProdCol = productSigCells[0].col;
      for (let c = leftmostSigProdCol; c < p.nCols; c++) {
        if (resultDigits[c] !== wDigits[c]) { firstChanged = c; break; }
      }
      if (firstChanged === p.nCols) firstChanged = leftmostSigProdCol;
    }

    const remainderCells: { col: number; digit: number }[] = [];
    const remainderAutoCells: { col: number; digit: number }[] = [];
    if (q !== 0) {
      // If subtraction yields zero, only require ONE typed cell at colP showing 0.
      // The student then advances to the next quotient digit (no more digits to bring down).
      if (resultValue === 0) {
        for (let c = 0; c < p.nCols; c++) {
          if (c === colP) remainderCells.push({ col: c, digit: 0 });
          else remainderAutoCells.push({ col: c, digit: resultDigits[c] });
        }
      } else {
        for (let c = 0; c < p.nCols; c++) {
          const cell = { col: c, digit: resultDigits[c] };
          if (c < firstChanged) remainderAutoCells.push(cell);
          else remainderCells.push(cell);
        }
      }
    }

    stages.push({
      stage, colP, W, wCells,
      windowVal, q, product, paddedProduct, resultValue,
      productSigCells, productPadCells, remainderCells, remainderAutoCells,
    });

    W = resultValue;
  }
  return stages;
};

export const buildSteps = (p: DivProblem, stages: DivStage[]): DivStep[] => {
  const steps: DivStep[] = [];
  for (const st of stages) {
    steps.push({
      stage: st.stage, kind: "quotient", colP: st.colP, wCells: st.wCells,
      targetCol: st.colP, expectedDigit: st.q,
      windowVal: st.windowVal, q: st.q, product: st.product, paddedProduct: st.paddedProduct, resultValue: st.resultValue,
    });
    if (st.q === 0) continue;

    const pTot = st.productSigCells.length;
    st.productSigCells.forEach((cell, idx) => {
      steps.push({
        stage: st.stage, kind: "product", colP: st.colP, wCells: st.wCells,
        targetCol: cell.col, expectedDigit: cell.digit,
        windowVal: st.windowVal, q: st.q, product: st.product, paddedProduct: st.paddedProduct, resultValue: st.resultValue,
        prodDigitIdx: idx, prodTotalDigits: pTot,
      });
    });

    const rTot = st.remainderCells.length;
    if (rTot === 0) continue;
    st.remainderCells.forEach((cell, idx) => {
      steps.push({
        stage: st.stage, kind: "remainder", colP: st.colP, wCells: st.wCells,
        targetCol: cell.col, expectedDigit: cell.digit,
        windowVal: st.windowVal, q: st.q, product: st.product, paddedProduct: st.paddedProduct, resultValue: st.resultValue,
        remDigitIdx: idx, remTotalDigits: rTot,
      });
    });
  }
  return steps;
};
