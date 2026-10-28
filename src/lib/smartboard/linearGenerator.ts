// Linear-equation question generator.
// Produces Node[] trees (rendered by MathRender) for Easy / Medium / Hard.

import { Node, mkBracket, mkFrac, mkNum, mkOp, mkVar, mkEq } from "@/lib/mathboard/tokens";
import { asciiToNodes } from "./nodeUtils";
import { buildBank, BankEntry } from "./solver";
import { buildSolutionMemory, type SolutionMethod } from "./solutionMemory";

export type Difficulty = "easy" | "medium" | "hard";

export interface Question {
  id: string;
  ascii: string;       // human reference
  nodes: Node[];       // rendered tree
  difficulty: Difficulty;
  /** Pre-solved typed symbol bank for this question. */
  bank: BankEntry[];
  /** Final value of x as ascii ("4", "-3", "5/2"), if solvable. */
  solutionAscii: string | null;
  /** Hidden pre-computed pedagogical solution chains. */
  methods: SolutionMethod[];
}

const rid = () => `q${Math.random().toString(36).slice(2, 8)}`;
const rint = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

const easy = (): Question => {
  const variants = [
    () => {
      // ax + b = c
      const a = rint(2, 5), x = rint(2, 9), b = rint(1, 9);
      const c = a * x + b;
      return { ascii: `${a}x+${b}=${c}`, nodes: asciiToNodes(`${a}x+${b}=${c}`) };
    },
    () => {
      // x + b = c
      const x = rint(2, 12), b = rint(1, 9);
      const c = x + b;
      return { ascii: `x+${b}=${c}`, nodes: asciiToNodes(`x+${b}=${c}`) };
    },
    () => {
      // ax = c
      const a = rint(2, 6), x = rint(2, 9);
      const c = a * x;
      return { ascii: `${a}x=${c}`, nodes: asciiToNodes(`${a}x=${c}`) };
    },
  ];
  const v = variants[rint(0, variants.length - 1)]();
  return finalize(v, "easy");
};

const medium = (): Question => {
  const variants = [
    () => {
      // a(x + b) = c
      const a = rint(2, 5), b = rint(1, 6), x = rint(2, 8);
      const c = a * (x + b);
      const ascii = `${a}(x+${b})=${c}`;
      // Build with explicit bracket node.
      const br = mkBracket("inline", "(");
      br.body = [mkVar("x"), mkOp("+"), mkNum(String(b))];
      const nodes: Node[] = [mkNum(String(a)), br, mkEq("="), mkNum(String(c))];
      return { ascii, nodes };
    },
    () => {
      // ax + b = cx + d  (variable both sides)
      const a = rint(3, 6), c = rint(1, a - 1);
      const x = rint(2, 8);
      const d = rint(1, 9);
      const b = (c - a) * x + d; // ensures solvable integer
      const ascii = `${a}x+${b}=${c}x+${d}`;
      return { ascii, nodes: asciiToNodes(ascii) };
    },
    () => {
      // x/k + b = c
      const k = rint(2, 5), x = rint(2, 9) * k, b = rint(1, 6);
      const c = x / k + b;
      const f = mkFrac(); f.num = [mkVar("x")]; f.den = [mkNum(String(k))];
      const nodes: Node[] = [f, mkOp("+"), mkNum(String(b)), mkEq("="), mkNum(String(c))];
      return { ascii: `x/${k}+${b}=${c}`, nodes };
    },
  ];
  const v = variants[rint(0, variants.length - 1)]();
  return finalize(v, "medium");
};

const hard = (): Question => {
  const variants = [
    () => {
      // a(bx - c) + d = x + e
      const a = rint(2, 3), b = rint(2, 4), c = rint(2, 6), d = rint(2, 6);
      const x = rint(2, 6);
      const e = a * (b * x - c) + d - x;
      const inner = mkBracket("inline", "(");
      inner.body = [mkNum(String(b)), mkVar("x"), mkOp("-"), mkNum(String(c))];
      const nodes: Node[] = [
        mkNum(String(a)), inner, mkOp("+"), mkNum(String(d)),
        mkEq("="), mkVar("x"), mkOp("+"), mkNum(String(e)),
      ];
      return { ascii: `${a}(${b}x-${c})+${d}=x+${e}`, nodes };
    },
    () => {
      // (ax - b)/k + c = d
      const k = rint(3, 6), a = rint(2, 4), b = rint(1, 5), c = rint(2, 5);
      const x = rint(2, 6);
      const d = (a * x - b) / k + c;
      if (!Number.isInteger(d)) return null as any;
      const f = mkFrac();
      f.num = [mkNum(String(a)), mkVar("x"), mkOp("-"), mkNum(String(b))];
      f.den = [mkNum(String(k))];
      const nodes: Node[] = [f, mkOp("+"), mkNum(String(c)), mkEq("="), mkNum(String(d))];
      return { ascii: `(${a}x-${b})/${k}+${c}=${d}`, nodes };
    },
  ];
  for (let tries = 0; tries < 10; tries++) {
    const v = variants[rint(0, variants.length - 1)]();
    if (v) return finalize(v, "hard");
  }
  return easy();
};

const finalize = (
  v: { ascii: string; nodes: Node[] },
  difficulty: Difficulty,
): Question => {
  const { entries, solutionAscii } = buildBank(v.ascii);
  const methods = buildSolutionMemory(v.ascii);
  return { id: rid(), ascii: v.ascii, nodes: v.nodes, difficulty, bank: entries, solutionAscii, methods };
};

export const generateQuestion = (d: Difficulty): Question => {
  if (d === "easy") return easy();
  if (d === "medium") return medium();
  return hard();
};

