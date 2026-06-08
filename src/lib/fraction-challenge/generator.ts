// Fraction Challenge question generator.
// Returns a MathBoard Node[] representing the question (e.g. "1/3 + 1/6").

import { Node, mkFrac, mkMixed, mkNum, mkOp } from "@/lib/mathboard/tokens";
import { Frac, parseExpr, reduce } from "./validator";

export type ChallengeKind =
  | "addition"
  | "subtraction"
  | "mixed"
  | "multiplication"
  | "division"
  | "mul-div";
export type Difficulty = "easy" | "medium" | "hard";

export type AnyOp = "+" | "-" | "*" | "/";

const ri = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// Build a frac node with simple integer numerator/denominator.
const fracNode = (num: number, den: number): Node => {
  const n = mkFrac();
  (n as any).num = String(num).split("").map(mkNum);
  (n as any).den = String(den).split("").map(mkNum);
  return n;
};

const mixedNode = (whole: number, num: number, den: number): Node => {
  const m = mkMixed();
  (m as any).whole = String(whole).split("").map(mkNum);
  (m as any).num = String(num).split("").map(mkNum);
  (m as any).den = String(den).split("").map(mkNum);
  return m;
};

const intNodes = (v: number): Node[] => String(v).split("").map(mkNum);

const opNode = (op: AnyOp): Node => mkOp(op);

interface Term {
  whole?: number;     // optional (mixed)
  num: number;        // > 0
  den: number;        // > 0
}

const termValue = (t: Term): Frac => {
  const w = t.whole ?? 0;
  return { n: (w * t.den + t.num), d: t.den };
};

const buildNodes = (terms: Term[], ops: AnyOp[]): Node[] => {
  const out: Node[] = [];
  terms.forEach((t, i) => {
    if (i > 0) out.push(opNode(ops[i - 1]));
    if (t.whole && t.whole > 0) out.push(mixedNode(t.whole, t.num, t.den));
    else out.push(fracNode(t.num, t.den));
  });
  return out;
};

const fracToTerm = (f: Frac): Term => {
  const n = Math.abs(f.n);
  const d = f.d;
  if (n < d) return { num: n, den: d };
  return { whole: Math.floor(n / d), num: n % d || 0, den: d };
};

const evalTerms = (terms: Term[], ops: AnyOp[]): Frac => {
  // Left-to-right with proper precedence: handle * and / first, then + and -.
  // Build value list then collapse. Simple two-pass.
  let vals: Frac[] = terms.map(termValue);
  let opsLeft: AnyOp[] = [...ops];
  // First pass: collapse * and /
  let i = 0;
  while (i < opsLeft.length) {
    const op = opsLeft[i];
    if (op === "*" || op === "/") {
      const a = vals[i];
      const b = vals[i + 1];
      const merged: Frac = op === "*"
        ? reduce({ n: a.n * b.n, d: a.d * b.d })
        : reduce({ n: a.n * b.d, d: a.d * b.n });
      vals.splice(i, 2, merged);
      opsLeft.splice(i, 1);
    } else {
      i++;
    }
  }
  // Second pass: + and -
  let acc = vals[0];
  for (let j = 0; j < opsLeft.length; j++) {
    const v = vals[j + 1];
    acc = opsLeft[j] === "+"
      ? reduce({ n: acc.n * v.d + v.n * acc.d, d: acc.d * v.d })
      : reduce({ n: acc.n * v.d - v.n * acc.d, d: acc.d * v.d });
  }
  return acc;
};

export interface GeneratedQuestion {
  nodes: Node[];
  answer: Frac;
  display: string;
}

const randTerm = (denPool: number[], maxNum: number): Term => {
  const den = pick(denPool);
  const num = ri(1, Math.min(den - 1, maxNum));
  return { num, den };
};

const randMixedTerm = (denPool: number[]): Term => {
  const den = pick(denPool);
  const num = ri(1, den - 1);
  const whole = ri(1, 5);
  return { whole, num, den };
};

const display = (terms: Term[], ops: AnyOp[]): string => {
  const sym = (o: AnyOp) => o === "*" ? "×" : o === "/" ? "÷" : o;
  return terms.map((t, i) => {
    const part = t.whole ? `${t.whole} ${t.num}/${t.den}` : `${t.num}/${t.den}`;
    return i === 0 ? part : ` ${sym(ops[i - 1])} ${part}`;
  }).join("");
};

const opChoicesFor = (kind: ChallengeKind): AnyOp[] => {
  switch (kind) {
    case "addition": return ["+"];
    case "subtraction": return ["-"];
    case "mixed": return ["+", "-"];
    case "multiplication": return ["*"];
    case "division": return ["/"];
    case "mul-div": return ["*", "/"];
  }
};

const isMulDivKind = (k: ChallengeKind) =>
  k === "multiplication" || k === "division" || k === "mul-div";

export const generateQuestion = (kind: ChallengeKind, diff: Difficulty): GeneratedQuestion => {
  const opChoices = opChoicesFor(kind);
  const mulDiv = isMulDivKind(kind);

  for (let attempt = 0; attempt < 80; attempt++) {
    let terms: Term[] = [];
    let ops: AnyOp[] = [];

    if (mulDiv) {
      // Multiplication / division of fractions
      if (diff === "easy") {
        const d1 = ri(2, 6);
        const d2 = ri(2, 6);
        terms = [
          { num: ri(1, d1 - 1), den: d1 },
          { num: ri(1, d2 - 1), den: d2 },
        ];
        ops = [pick(opChoices)];
      } else if (diff === "medium") {
        const d1 = ri(2, 9);
        const d2 = ri(2, 9);
        terms = [
          { num: ri(1, d1 - 1), den: d1 },
          { num: ri(1, d2 - 1), den: d2 },
        ];
        ops = [pick(opChoices)];
      } else {
        // hard: 3 terms, mixed numbers possible
        const d1 = pick([2, 3, 4, 5]);
        const d2 = pick([2, 3, 4, 5]);
        const d3 = pick([2, 3, 4, 5]);
        terms = [
          Math.random() < 0.4 ? randMixedTerm([d1]) : { num: ri(1, d1 - 1), den: d1 },
          { num: ri(1, d2 - 1), den: d2 },
          { num: ri(1, d3 - 1), den: d3 },
        ];
        ops = [pick(opChoices), pick(opChoices)];
      }
    } else if (diff === "easy") {
      const den = ri(3, 8);
      terms = [{ num: ri(1, den - 1), den }, { num: ri(1, den - 1), den }];
      ops = [pick(opChoices)];
    } else if (diff === "medium") {
      const small = pick([2, 3, 4, 5, 6]);
      const large = small * pick([2, 3]);
      const dens = Math.random() < 0.5 ? [small, large] : [large, small];
      terms = [
        { num: ri(1, dens[0] - 1), den: dens[0] },
        { num: ri(1, dens[1] - 1), den: dens[1] },
      ];
      ops = [pick(opChoices)];
    } else {
      const dens = [pick([3, 4, 6]), pick([4, 6, 8]), pick([2, 3, 4])];
      terms = [
        Math.random() < 0.5 ? randMixedTerm([dens[0]]) : randTerm([dens[0]], dens[0] - 1),
        randTerm([dens[1]], dens[1] - 1),
        randTerm([dens[2]], dens[2] - 1),
      ];
      ops = [pick(opChoices), pick(opChoices)];
    }

    const answer = evalTerms(terms, ops);
    if (answer.n <= 0) continue;
    if (answer.d > 36) continue;
    if (answer.n / answer.d > 20) continue;

    const nodes = buildNodes(terms, ops);
    return { nodes, answer, display: display(terms, ops) };
  }
  // Fallback
  const nodes = buildNodes([{ num: 1, den: 2 }, { num: 1, den: 4 }], [opChoices[0]]);
  const ans = evalTerms([{ num: 1, den: 2 }, { num: 1, den: 4 }], [opChoices[0]]);
  return { nodes, answer: ans, display: display([{ num: 1, den: 2 }, { num: 1, den: 4 }], [opChoices[0]]) };
};

