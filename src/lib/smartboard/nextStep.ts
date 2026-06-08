// FlowBoard — Adaptive Next-Step Engine.
//
// Given the student's last verified equation (or the original question if none
// has been verified yet), compute the NEXT mathematically-required equation
// and return it broken into atomic, scattered pieces.
//
// This is NOT autocomplete. There is no ranking of bank entries. The pieces
// returned are exactly the terms the student needs to write the next step —
// nothing more, nothing less. The student arranges them.

import type { Question } from "./linearGenerator";
import { parseLin, type Lin, type Frac } from "./canonical";
import { findNextState, type SolutionMethod, type Piece as MemPiece } from "./solutionMemory";

export interface Piece {
  id: string;
  ascii: string;   // text inserted on tap
  display: string; // pretty (× ÷ −)
}

export interface NextStep {
  pieces: Piece[];
  goalAscii: string; // the target next line (for debugging / future)
}

const norm = (s: string) =>
  s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");

const pretty = (s: string) =>
  s.replace(/\*/g, "·").replace(/\//g, "÷").replace(/-/g, "−");

const fInt = (f: Frac) => (f.d === 1 ? f.n : NaN);
const isInt = (f: Frac) => f.d === 1;
const fracStr = (f: Frac) => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);

// Render an x-term coefficient as ascii: 1→"x", -1→"-x", k→"kx".
const xTerm = (a: Frac): string => {
  if (!isInt(a)) return `${fracStr(a)}x`;
  const k = a.n;
  if (k === 1) return "x";
  if (k === -1) return "-x";
  return `${k}x`;
};

// Signed constant ascii: 5→"+5", -5→"-5", 0→"".
const signedConst = (b: Frac): string => {
  if (b.n === 0) return "";
  if (!isInt(b)) return b.n < 0 ? `-${fracStr({ n: -b.n, d: b.d })}` : `+${fracStr(b)}`;
  return b.n < 0 ? `${b.n}` : `+${b.n}`;
};

// Bare literal ascii: 5→"5", -5→"-5".
const litStr = (b: Frac): string => (isInt(b) ? String(b.n) : fracStr(b));

const piece = (ascii: string, idx: number): Piece => ({
  id: `p${idx}-${ascii}`,
  ascii,
  display: pretty(ascii),
});

// Detect bracket / fraction in raw ascii (cheap regex).
const hasBracket = (a: string) => /\(/.test(a);
const hasFraction = (a: string) => {
  // Fraction in our ascii means "(...)/N" or "x/N" — a slash that follows
  // a closing paren, a digit, or 'x', and is followed by a digit/var/(.
  if (!/\//.test(a)) return false;
  return /[)\dx]\/[\d(x]/.test(a);
};

// Extract the first denominator that wraps the lhs as "(...)/k" or "x/k".
const extractDenominator = (a: string): number | null => {
  const m = a.match(/\/(\d+)/);
  return m ? Number(m[1]) : null;
};

// Multiply Lin by integer k.
const mulFrac = (f: Frac, k: number): Frac => {
  const n = f.n * k;
  const d = f.d;
  // already reduced; if d divides k, simplify
  const g = (() => {
    let x = Math.abs(n), y = d;
    while (y) { [x, y] = [y, x % y]; }
    return x || 1;
  })();
  return { n: n / g, d: d / g };
};
const mulLin = (l: Lin, k: number): Lin => ({ a: mulFrac(l.a, k), b: mulFrac(l.b, k) });
const subFrac = (a: Frac, b: Frac): Frac => {
  const n = a.n * b.d - b.n * a.d;
  const d = a.d * b.d;
  let g = (() => {
    let x = Math.abs(n), y = Math.abs(d);
    while (y) { [x, y] = [y, x % y]; }
    return x || 1;
  })();
  return { n: n / g, d: d / g };
};
const negFrac = (a: Frac): Frac => ({ n: -a.n, d: a.d });
const subLin = (x: Lin, y: Lin): Lin => ({ a: subFrac(x.a, y.a), b: subFrac(x.b, y.b) });
const divFracInt = (f: Frac, k: number): Frac => {
  const n = f.n;
  const d = f.d * k;
  const sign = d < 0 ? -1 : 1;
  let absN = Math.abs(n), absD = Math.abs(d);
  let g = absN; let y = absD;
  while (y) { [g, y] = [y, g % y]; }
  g = g || 1;
  return { n: (sign * n) / g, d: Math.abs(d) / g };
};

/**
 * Compute the next mathematical step from a verified equation.
 * Returns null if the equation is already in final form (`x = k`).
 */
export const computeNextStep = (verifiedAscii: string): NextStep | null => {
  const a = norm(verifiedAscii);
  const eq = a.indexOf("=");
  if (eq < 0) return null;
  const lhsStr = a.slice(0, eq);
  const rhsStr = a.slice(eq + 1);

  const lhs = parseLin(lhsStr);
  const rhs = parseLin(rhsStr);
  if (!lhs || !rhs) return null;

  const pieces: Piece[] = [];
  let pi = 0;
  const add = (s: string) => { if (s) pieces.push(piece(s, pi++)); };

  // --- Already final: x = k ---
  if (
    isInt(lhs.a) && Math.abs(fInt(lhs.a)) === 1 && lhs.b.n === 0 &&
    rhs.a.n === 0
  ) {
    return null;
  }

  // --- Case 1: expansion (brackets present) ---
  if (hasBracket(a)) {
    // Expanded form pieces from each side's Lin.
    if (lhs.a.n !== 0) add(xTerm(lhs.a));
    if (lhs.b.n !== 0) add(signedConst(lhs.b));
    if (rhs.a.n !== 0) add(xTerm(rhs.a));
    if (rhs.b.n !== 0 && !(rhs.a.n === 0 && pieces.some((p) => p.ascii === litStr(rhs.b)))) {
      // RHS literal-only → bare literal (no leading +). Mixed rhs → signed.
      if (rhs.a.n === 0) add(litStr(rhs.b));
      else add(signedConst(rhs.b));
    }
    return { pieces, goalAscii: "expand" };
  }

  // --- Case 2: fraction → multiply by denominator ---
  if (hasFraction(a)) {
    const k = extractDenominator(a);
    if (k && k > 1) {
      const newLhs = mulLin(lhs, k);
      const newRhs = mulLin(rhs, k);
      // Pieces: ×k, then the new terms.
      add(`*${k}`);
      if (newLhs.a.n !== 0) add(xTerm(newLhs.a));
      if (newLhs.b.n !== 0) add(signedConst(newLhs.b));
      if (newRhs.a.n !== 0) add(xTerm(newRhs.a));
      if (newRhs.b.n !== 0) {
        if (newRhs.a.n === 0) add(litStr(newRhs.b));
        else add(signedConst(newRhs.b));
      }
      return { pieces, goalAscii: "clear-fraction" };
    }
  }

  // --- Case 3: x on both sides → combine x terms ---
  if (rhs.a.n !== 0) {
    // Move rhs.a*x to lhs.
    const newLhsA = subFrac(lhs.a, rhs.a);
    // pieces: (A-C)x, +B (if any), D (rhs constant after removing Cx)
    if (newLhsA.n !== 0) add(xTerm(newLhsA));
    if (lhs.b.n !== 0) add(signedConst(lhs.b));
    if (rhs.b.n !== 0) add(litStr(rhs.b));
    else add("0");
    return { pieces, goalAscii: "combine-x" };
  }

  // --- Case 4: isolate x-term → move constant across ---
  if (lhs.a.n !== 0 && lhs.b.n !== 0) {
    add(xTerm(lhs.a));
    // rhs literal as bare
    add(litStr(rhs.b));
    // moved constant: -lhs.b, signed
    add(signedConst(negFrac(lhs.b)));
    return { pieces, goalAscii: "isolate" };
  }

  // --- Case 5: divide both sides by coefficient ---
  if (lhs.a.n !== 0 && (Math.abs(fInt(lhs.a)) !== 1 || !isInt(lhs.a))) {
    add("x");
    add(litStr(rhs.b));
    if (isInt(lhs.a)) add(`/${Math.abs(fInt(lhs.a))}`);
    else add(`/${fracStr(lhs.a)}`);
    // Do NOT include the simplified result here — that would leak the answer.
    return { pieces, goalAscii: "divide" };
  }

  // --- Case 6: lhs is ±x, rhs literal → final ---
  if (isInt(lhs.a) && Math.abs(fInt(lhs.a)) === 1 && lhs.b.n === 0) {
    add("x");
    const sol = fInt(lhs.a) === 1 ? rhs.b : negFrac(rhs.b);
    add(litStr(sol));
    return { pieces, goalAscii: "final" };
  }

  return null;
};

// ---- Scatter ----
const SCATTER: number[][] = [
  [2, 4, 3, 1],
  [4, 1, 3, 2],
  [3, 1, 4, 2],
  [1, 3, 2, 4],
];
export const scatterPieces = (items: Piece[], patternIdx: number): Piece[] => {
  if (items.length < 2) return items.slice();
  const pat = SCATTER[patternIdx % SCATTER.length];
  const head = items.slice(0, Math.min(4, items.length));
  const tail = items.slice(head.length);
  const reordered: Piece[] = [];
  for (const oneBased of pat) {
    const idx = oneBased - 1;
    if (idx < head.length && !reordered.includes(head[idx])) reordered.push(head[idx]);
  }
  for (const h of head) if (!reordered.includes(h)) reordered.push(h);
  return [...reordered, ...tail];
};

/** Filter out pieces whose ascii is already present in the active line ascii. */
export const filterUsedPieces = (pieces: Piece[], activeAscii: string): Piece[] => {
  const a = norm(activeAscii);
  // Detect a top-level fraction in active ascii (rhs of '=') for struct filter.
  const eq = a.indexOf("=");
  let activeHasFrac = false;
  if (eq >= 0) {
    const rhs = a.slice(eq + 1);
    let depth = 0;
    for (let k = 0; k < rhs.length; k++) {
      const c = rhs[k];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (depth === 0 && c === "/") { activeHasFrac = true; break; }
    }
  }
  if (!a) return pieces;
  return pieces.filter((p) => {
    if (p.ascii.startsWith("__struct:")) {
      if (p.ascii === "__struct:frac") return !activeHasFrac;
      return true;
    }
    const needle = norm(p.ascii);
    if (!needle) return true;
    return !a.includes(needle);
  });
};

// ---------- Memory-aware next step ----------
// Convert a memory Piece (already pretty) into a nextStep Piece.
const fromMemPiece = (mp: MemPiece): Piece => ({
  id: mp.id, ascii: mp.ascii, display: mp.display,
});

/**
 * Memory-aware next step: look up the verified line in pre-computed solution
 * methods, return pieces from the next state. Falls back to the heuristic
 * `computeNextStep` if no method matches.
 */
export const computeNextStepFromMemory = (
  methods: SolutionMethod[],
  verifiedAscii: string,
): NextStep | null => {
  const next = findNextState(methods, verifiedAscii);
  if (next) {
    return { pieces: next.pieces.map(fromMemPiece), goalAscii: next.ascii };
  }
  return computeNextStep(verifiedAscii);
};

