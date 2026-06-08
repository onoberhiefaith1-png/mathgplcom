// FlowBoard — Hidden Solution Memory.
//
// Pre-computes a strict, one-transformation-at-a-time chain of states for each
// question. The middle floating row reads from the NEXT state only — never two
// steps ahead, never the final answer too early.
//
// Each state carries explicit term lists per side (so we can distinguish
// "5x = 60 − 30" from "5x = 30" even though their Lin form is identical), plus
// the atomic floating pieces the student needs to write that exact line.

import { parseLin, type Lin, type Frac } from "./canonical";

// ---------- Frac helpers ----------
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const F = (n: number, d = 1): Frac => {
  if (d === 0) return { n: NaN, d: 1 };
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  return { n: n / g, d: d / g };
};
const fAdd = (a: Frac, b: Frac) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const fSub = (a: Frac, b: Frac) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const fMul = (a: Frac, b: Frac) => F(a.n * b.n, a.d * b.d);
const fDiv = (a: Frac, b: Frac) => F(a.n * b.d, a.d * b.n);
const fEq  = (a: Frac, b: Frac) => a.n * b.d === b.n * a.d;
const fNeg = (a: Frac): Frac => F(-a.n, a.d);
const fIsZero = (f: Frac) => f.n === 0;
const fIsOne = (f: Frac) => f.n === f.d && f.n !== 0;
const linEq = (a: Lin, b: Lin) => fEq(a.a, b.a) && fEq(a.b, b.b);

const fracStr = (f: Frac) => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);

// ---------- Term model ----------
// A Term is either a coefficient * x ("isX") or a bare constant.
interface Term { c: Frac; isX: boolean }
type Side = Term[];

const tToLin = (s: Side): Lin => {
  let a: Frac = F(0), b: Frac = F(0);
  for (const t of s) {
    if (t.isX) a = fAdd(a, t.c);
    else b = fAdd(b, t.c);
  }
  return { a, b };
};

const tNeg = (t: Term): Term => ({ c: fNeg(t.c), isX: t.isX });

// Render a single term as ascii, with an explicit sign prefix unless it's the
// first term on its side (handled by caller).
const renderTermSigned = (t: Term): string => {
  const c = t.c;
  if (t.isX) {
    if (c.d === 1) {
      if (c.n === 1) return "+x";
      if (c.n === -1) return "-x";
      if (c.n >= 0) return `+${c.n}x`;
      return `${c.n}x`;
    }
    return c.n >= 0 ? `+${fracStr(c)}x` : `-${fracStr({ n: -c.n, d: c.d })}x`;
  }
  if (c.d === 1) return c.n >= 0 ? `+${c.n}` : `${c.n}`;
  return c.n >= 0 ? `+${fracStr(c)}` : `-${fracStr({ n: -c.n, d: c.d })}`;
};

const renderTermBare = (t: Term): string => {
  const c = t.c;
  if (t.isX) {
    if (c.d === 1) {
      if (c.n === 1) return "x";
      if (c.n === -1) return "-x";
      return `${c.n}x`;
    }
    return `${fracStr(c)}x`;
  }
  return c.d === 1 ? String(c.n) : fracStr(c);
};

const renderSide = (s: Side): string => {
  if (!s.length) return "0";
  let out = renderTermBare(s[0]);
  for (let i = 1; i < s.length; i++) out += renderTermSigned(s[i]);
  return out;
};

// ---------- Public state shape ----------
export interface Piece { id: string; ascii: string; display: string }

export interface SolutionState {
  lhs: Lin;
  rhs: Lin;
  hasBracket: boolean;
  hasFraction: boolean;
  lhsTerms: number;
  rhsTerms: number;
  ascii: string;
  pieces: Piece[];
}

export interface SolutionMethod {
  id: string;
  states: SolutionState[];
}

// ---------- Piece building ----------
const pretty = (s: string) =>
  s.replace(/\*/g, "·").replace(/\//g, "÷").replace(/-/g, "−");

let pieceCounter = 0;
const piece = (ascii: string): Piece => {
  const id = `p${pieceCounter++}-${ascii}`;
  return { id, ascii, display: pretty(ascii) };
};

// Build pieces for a given (lhs, rhs) state. First lhs term and first rhs term
// render bare; subsequent terms include their sign.
const piecesForState = (
  lhs: Side, rhs: Side, hasFraction: boolean, fracNum?: Frac, fracDen?: Frac,
): Piece[] => {
  const out: Piece[] = [];
  // Special fraction case: rhs is a single fraction, render as separate
  // numerator + denominator + the structure marker.
  if (hasFraction && fracNum && fracDen) {
    // LHS pieces (typically just "x").
    if (lhs.length) {
      out.push(piece(renderTermBare(lhs[0])));
      for (let i = 1; i < lhs.length; i++) out.push(piece(renderTermSigned(lhs[i])));
    }
    // Fraction structure + numerator + denominator.
    out.push(piece("__struct:frac"));
    out.push(piece(fracNum.d === 1 ? String(fracNum.n) : fracStr(fracNum)));
    out.push(piece(fracDen.d === 1 ? String(fracDen.n) : fracStr(fracDen)));
    return out;
  }
  if (lhs.length) {
    out.push(piece(renderTermBare(lhs[0])));
    for (let i = 1; i < lhs.length; i++) out.push(piece(renderTermSigned(lhs[i])));
  }
  if (rhs.length) {
    out.push(piece(renderTermBare(rhs[0])));
    for (let i = 1; i < rhs.length; i++) out.push(piece(renderTermSigned(rhs[i])));
  }
  return out;
};

const makeState = (
  lhs: Side, rhs: Side,
  opts: { hasBracket?: boolean; hasFraction?: boolean; fracNum?: Frac; fracDen?: Frac; ascii?: string } = {},
): SolutionState => {
  const hasBracket = !!opts.hasBracket;
  const hasFraction = !!opts.hasFraction;
  const ascii = opts.ascii ?? `${renderSide(lhs)}=${renderSide(rhs)}`;
  return {
    lhs: tToLin(lhs),
    rhs: tToLin(rhs),
    hasBracket,
    hasFraction,
    lhsTerms: lhs.length,
    rhsTerms: rhs.length,
    ascii,
    pieces: piecesForState(lhs, rhs, hasFraction, opts.fracNum, opts.fracDen),
  };
};

// ---------- Term-list parser for the question ascii ----------
// Walks the top level, splitting on '+' / '-' (respecting bracket depth).
// Each top-level chunk is either:
//   - a leading "k(" bracket → expand: returns multiple Terms
//   - a constant or coef*x term
const norm = (s: string) => s.replace(/×/g, "*").replace(/−/g, "-").replace(/\s+/g, "");

const parseChunkToTerms = (chunk: string): Side | null => {
  // chunk has a leading sign (+ or -) plus body.
  if (!chunk.length) return [];
  const sign = chunk[0] === "-" ? -1 : 1;
  const body = (chunk[0] === "+" || chunk[0] === "-") ? chunk.slice(1) : chunk;
  if (!body.length) return null;

  // bracket form: "k(...)" where k is optional integer
  const brM = body.match(/^(\d*)\((.+)\)$/);
  if (brM) {
    const k = brM[1] ? Number(brM[1]) : 1;
    const inner = brM[2];
    const innerTerms = parseSideTerms(inner);
    if (!innerTerms) return null;
    // multiply each inner term by sign*k
    return innerTerms.map((t) => ({ c: F(sign * k * t.c.n, t.c.d), isX: t.isX }));
  }

  // standalone x or coef*x
  const xM = body.match(/^(\d*)x$/);
  if (xM) {
    const k = xM[1] ? Number(xM[1]) : 1;
    return [{ c: F(sign * k), isX: true }];
  }
  // bare constant
  const nM = body.match(/^(\d+)$/);
  if (nM) return [{ c: F(sign * Number(nM[1])), isX: false }];

  // fallback: parseLin
  const lin = parseLin(body);
  if (!lin) return null;
  const out: Side = [];
  if (!fIsZero(lin.a)) out.push({ c: { n: sign * lin.a.n, d: lin.a.d }, isX: true });
  if (!fIsZero(lin.b)) out.push({ c: { n: sign * lin.b.n, d: lin.b.d }, isX: false });
  return out;
};

// Split top-level (respecting parens) at +/- boundaries.
const splitTop = (s: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") { depth++; buf += c; continue; }
    if (c === ")") { depth--; buf += c; continue; }
    if (depth === 0 && (c === "+" || c === "-") && i > 0) {
      out.push(buf);
      buf = c;
      continue;
    }
    buf += c;
  }
  if (buf) out.push(buf);
  // Ensure leading chunk has explicit sign.
  if (out.length && out[0][0] !== "+" && out[0][0] !== "-") out[0] = "+" + out[0];
  return out;
};

const parseSideTerms = (s: string): Side | null => {
  const chunks = splitTop(s);
  const out: Side = [];
  for (const c of chunks) {
    const ts = parseChunkToTerms(c);
    if (!ts) return null;
    out.push(...ts);
  }
  return out;
};

// ---------- Method A builder (strict per-step) ----------
const buildMethodA = (questionAscii: string): SolutionMethod | null => {
  pieceCounter = 0;
  const a = norm(questionAscii);
  const eq = a.indexOf("=");
  if (eq < 0) return null;
  const lhsRaw = a.slice(0, eq);
  const rhsRaw = a.slice(eq + 1);
  const lhs0 = parseSideTerms(lhsRaw);
  const rhs0 = parseSideTerms(rhsRaw);
  if (!lhs0 || !rhs0) return null;

  const states: SolutionState[] = [];
  const has = /\(/.test(a);

  const push = (s: SolutionState) => {
    const last = states[states.length - 1];
    if (last
      && linEq(last.lhs, s.lhs) && linEq(last.rhs, s.rhs)
      && last.hasBracket === s.hasBracket
      && last.hasFraction === s.hasFraction
      && last.lhsTerms === s.lhsTerms
      && last.rhsTerms === s.rhsTerms) return;
    states.push(s);
  };

  // S0: original (with bracket if present).
  if (has) {
    push(makeState(lhs0, rhs0, { hasBracket: true, ascii: questionAscii }));
  }

  // S1: expanded (no bracket). Re-parse without brackets by pushing inner
  // multiplied terms — already handled by parseSideTerms which expands.
  let lhs: Side = lhs0.slice();
  let rhs: Side = rhs0.slice();
  if (has) push(makeState(lhs, rhs));

  // S2: combine constants (per side) if there are 2+ constant terms.
  const combineConsts = (s: Side): Side => {
    const xs = s.filter((t) => t.isX);
    const cs = s.filter((t) => !t.isX);
    if (cs.length <= 1) return s;
    let sum: Frac = F(0);
    for (const t of cs) sum = fAdd(sum, t.c);
    const out: Side = [...xs];
    if (!fIsZero(sum)) out.push({ c: sum, isX: false });
    return out;
  };
  const combineXs = (s: Side): Side => {
    const cs = s.filter((t) => !t.isX);
    const xs = s.filter((t) => t.isX);
    if (xs.length <= 1) return s;
    let sum: Frac = F(0);
    for (const t of xs) sum = fAdd(sum, t.c);
    const out: Side = [];
    if (!fIsZero(sum)) out.push({ c: sum, isX: true });
    out.push(...cs);
    return out;
  };
  // Combine x then constants on each side, separately.
  const lhsCx = combineXs(lhs);
  const lhsC = combineConsts(lhsCx);
  if (lhsC !== lhs) {
    lhs = lhsC;
    push(makeState(lhs, rhs));
  }
  const rhsCx = combineXs(rhs);
  const rhsC = combineConsts(rhsCx);
  if (rhsC !== rhs) {
    rhs = rhsC;
    push(makeState(lhs, rhs));
  }

  // S3: move x from rhs to lhs (combined, single state).
  const rhsX = rhs.find((t) => t.isX);
  if (rhsX) {
    // lhs gets +(-rhsX), rhs loses it.
    const lhsXTerm = lhs.find((t) => t.isX);
    let newLhs: Side;
    if (lhsXTerm) {
      const newCoef = fSub(lhsXTerm.c, rhsX.c);
      newLhs = lhs.map((t) => t.isX ? { c: newCoef, isX: true } : t).filter((t) => !(t.isX && fIsZero(t.c)));
    } else {
      newLhs = [{ c: fNeg(rhsX.c), isX: true }, ...lhs];
    }
    const newRhs = rhs.filter((t) => !t.isX);
    lhs = newLhs;
    rhs = newRhs;
    push(makeState(lhs, rhs));
  }

  // S4: move constant from lhs to rhs — UNCOMPUTED form ("Ax = D − B").
  const lhsConst = lhs.find((t) => !t.isX);
  if (lhsConst && !fIsZero(lhsConst.c)) {
    const newLhs = lhs.filter((t) => t.isX);
    const newRhs: Side = [...rhs, tNeg(lhsConst)];
    lhs = newLhs;
    rhs = newRhs;
    push(makeState(lhs, rhs));

    // S5: combine the new rhs constants.
    const r2 = combineConsts(rhs);
    if (r2 !== rhs) {
      rhs = r2;
      push(makeState(lhs, rhs));
    }
  }

  // S6: divide — show as fraction "x = (rhsConst) / A" first, unless A = 1.
  const lhsX = lhs.find((t) => t.isX);
  const rhsConst = rhs.find((t) => !t.isX);
  if (lhsX && !fIsOne(lhsX.c)) {
    const A = lhsX.c;
    const D = rhsConst ? rhsConst.c : F(0);
    // Handle A = -1 → x = -D directly (no fraction).
    if (A.d === 1 && A.n === -1) {
      const negD = fNeg(D);
      lhs = [{ c: F(1), isX: true }];
      rhs = fIsZero(negD) ? [{ c: F(0), isX: false }] : [{ c: negD, isX: false }];
      push(makeState(lhs, rhs));
    } else {
      // Fraction state: x = D / A
      const fracL: Side = [{ c: F(1), isX: true }];
      const fracR: Side = []; // rhs represented by fracNum/fracDen
      const fracAscii = `x=${fracStr(D)}/${fracStr(A)}`;
      // Compute Lin for fraction state: rhs = D/A.
      const dOverA = fDiv(D, A);
      // We synthesize a state manually so Lin matches a verified "x = N/M"
      // (which evaluates to dOverA), and keep hasFraction=true to disambiguate
      // it from the next "x = result" state.
      pieceCounter = pieceCounter; // no-op
      const st: SolutionState = {
        lhs: { a: F(1), b: F(0) },
        rhs: { a: F(0), b: dOverA },
        hasBracket: false,
        hasFraction: true,
        lhsTerms: 1,
        rhsTerms: 1,
        ascii: fracAscii,
        pieces: piecesForState(fracL, fracR, true, D, A),
      };
      push(st);

      // Final compute: x = result.
      const finalRhs: Side = [{ c: dOverA, isX: false }];
      const finalLhs: Side = [{ c: F(1), isX: true }];
      push(makeState(finalLhs, finalRhs));
    }
  }

  if (!states.length) return null;
  return { id: "A", states };
};

// ---------- Public API ----------

export const buildSolutionMemory = (questionAscii: string): SolutionMethod[] => {
  const m = buildMethodA(questionAscii);
  return m ? [m] : [];
};

// Detect if verified ascii currently shows a fraction "x = N/M" or any "/N" rhs.
const detectVerifiedFraction = (ascii: string): boolean => {
  const a = norm(ascii);
  const i = a.indexOf("=");
  if (i < 0) return false;
  const rhs = a.slice(i + 1);
  // top-level slash in rhs (ignoring nested parens) means fraction form.
  let depth = 0;
  for (let k = 0; k < rhs.length; k++) {
    const c = rhs[k];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && c === "/") return true;
  }
  return false;
};

const detectVerifiedBracket = (ascii: string): boolean => /\(/.test(ascii);

const countTopTerms = (s: string): number => {
  const x = norm(s);
  if (!x) return 0;
  let depth = 0, count = 1;
  for (let i = 1; i < x.length; i++) {
    const c = x[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && (c === "+" || c === "-")) count++;
  }
  return count;
};

/**
 * Find the state matching the verified line and return the next one in the
 * chain. Matching uses Lin equivalence per side AND structural fingerprint
 * (bracket flag, fraction flag, term counts) so that "5x = 60 − 30" and
 * "5x = 30" don't collide.
 */
export const findNextState = (
  methods: SolutionMethod[],
  verifiedAscii: string,
): SolutionState | null => {
  const a = norm(verifiedAscii);
  const eq = a.indexOf("=");
  if (eq < 0) return null;
  const lhsRaw = a.slice(0, eq);
  const rhsRaw = a.slice(eq + 1);
  const vL = parseLin(lhsRaw);
  const vR = parseLin(rhsRaw);
  if (!vL || !vR) return null;
  const vBracket = detectVerifiedBracket(verifiedAscii);
  const vFraction = detectVerifiedFraction(verifiedAscii);
  const vLT = countTopTerms(lhsRaw);
  const vRT = countTopTerms(rhsRaw);

  // Pass 1: full structural match.
  for (const m of methods) {
    for (let i = 0; i < m.states.length - 1; i++) {
      const s = m.states[i];
      if (linEq(s.lhs, vL) && linEq(s.rhs, vR)
        && s.hasBracket === vBracket
        && s.hasFraction === vFraction
        && s.lhsTerms === vLT
        && s.rhsTerms === vRT) {
        return m.states[i + 1];
      }
    }
  }
  // Pass 2: Lin + bracket/fraction match (relax term counts).
  for (const m of methods) {
    for (let i = 0; i < m.states.length - 1; i++) {
      const s = m.states[i];
      if (linEq(s.lhs, vL) && linEq(s.rhs, vR)
        && s.hasBracket === vBracket
        && s.hasFraction === vFraction) {
        return m.states[i + 1];
      }
    }
  }
  // Pass 3: Lin only.
  for (const m of methods) {
    for (let i = 0; i < m.states.length - 1; i++) {
      const s = m.states[i];
      if (linEq(s.lhs, vL) && linEq(s.rhs, vR)) {
        return m.states[i + 1];
      }
    }
  }
  return null;
};
