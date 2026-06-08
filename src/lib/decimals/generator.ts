// Decimal challenge question generators.
// Each generator returns MathBoard Node[] for the question along with the
// expected answer as a Frac (so it can be validated as decimal OR fraction).

import { Node, mkFrac, mkNum, mkOp } from "@/lib/mathboard/tokens";
import { decimalStringToFrac, Frac, reduce } from "./decimalUtils";

export type DecimalKind =
  | "frac-to-dec"
  | "dec-to-frac"
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "mixed";

export type Difficulty = "easy" | "medium" | "hard";

const ri = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const intNodes = (s: string): Node[] => s.split("").map(mkNum);

/** Build nodes for a decimal literal like "2.5". */
const decimalNodes = (s: string): Node[] => {
  const dot = s.indexOf(".");
  if (dot < 0) return intNodes(s);
  return [...intNodes(s.slice(0, dot)), mkOp("."), ...intNodes(s.slice(dot + 1))];
};

const fracNodes = (n: number, d: number): Node => {
  const f = mkFrac();
  (f as any).num = String(n).split("").map(mkNum);
  (f as any).den = String(d).split("").map(mkNum);
  return f;
};

const opNode = (op: "+" | "-" | "*" | "/") => mkOp(op);

const fracToDecimalString = (n: number, d: number): string => {
  // returns terminating decimal as string (assumes terminating)
  const v = n / d;
  return String(v);
};

export interface GeneratedDecimal {
  kind: DecimalKind;
  /** Question nodes shown in the question row. */
  nodes: Node[];
  /** Canonical expected value (as exact fraction). */
  answer: Frac;
  /** Original fraction for frac-to-dec (so validator can detect repeating). */
  source?: { n: number; d: number };
  /** Pretty display string. */
  display: string;
}

// ---------- Generators ----------

const genFracToDec = (diff: Difficulty): GeneratedDecimal => {
  let n: number, d: number;
  if (diff === "easy") {
    d = pick([2, 4, 5, 8, 10]);
    n = ri(1, d - 1);
  } else if (diff === "medium") {
    d = pick([16, 20, 25, 40, 50]);
    n = ri(1, d * 2 - 1);
  } else {
    d = pick([3, 6, 7, 9, 11, 12]);
    n = ri(1, d * 2 - 1);
  }
  const r = reduce({ n, d });
  return {
    kind: "frac-to-dec",
    nodes: [fracNodes(n, d)],
    answer: r,
    source: { n, d },
    display: `${n}/${d}`,
  };
};

const genDecToFrac = (diff: Difficulty): GeneratedDecimal => {
  // Pick a reduced fraction, present its decimal form.
  let n: number, d: number;
  if (diff === "easy") {
    d = pick([2, 4, 5, 10]);
    n = ri(1, d - 1);
  } else if (diff === "medium") {
    d = pick([4, 5, 8, 10, 20]);
    n = ri(1, d * 2);
  } else {
    d = pick([8, 16, 20, 25, 40]);
    n = ri(1, d * 3);
  }
  const r = reduce({ n, d });
  const decStr = fracToDecimalString(n, d);
  return {
    kind: "dec-to-frac",
    nodes: decimalNodes(decStr),
    answer: r,
    display: decStr,
  };
};

/** Random terminating decimal string (1–2 dp by difficulty). */
const randDec = (diff: Difficulty): string => {
  const dp = diff === "easy" ? 1 : diff === "medium" ? 2 : pick([2, 3]);
  const intMax = diff === "easy" ? 9 : diff === "medium" ? 20 : 50;
  const intP = ri(0, intMax);
  const fracP = ri(0, Math.pow(10, dp) - 1);
  const fracStr = String(fracP).padStart(dp, "0");
  // trim a bit, but keep at least one decimal digit
  return `${intP}.${fracStr}`;
};

const buildArith = (kind: DecimalKind, diff: Difficulty): GeneratedDecimal => {
  const opMap: Record<string, "+" | "-" | "*" | "/"> = {
    add: "+", sub: "-", mul: "*", div: "/",
  };
  for (let attempt = 0; attempt < 60; attempt++) {
    const a = randDec(diff);
    const b = randDec(diff);
    const fa = decimalStringToFrac(a)!;
    const fb = decimalStringToFrac(b)!;
    const op = opMap[kind];
    let ans: Frac | null = null;
    if (op === "+") ans = reduce({ n: fa.n * fb.d + fb.n * fa.d, d: fa.d * fb.d });
    if (op === "-") ans = reduce({ n: fa.n * fb.d - fb.n * fa.d, d: fa.d * fb.d });
    if (op === "*") ans = reduce({ n: fa.n * fb.n, d: fa.d * fb.d });
    if (op === "/") {
      if (fb.n === 0) continue;
      ans = reduce({ n: fa.n * fb.d, d: fa.d * fb.n });
    }
    if (!ans) continue;
    if (op === "-" && ans.n < 0) continue; // keep positive for early grades
    if (op === "+" && fa.n === 0 && fb.n === 0) continue;
    return {
      kind,
      nodes: [...decimalNodes(a), opNode(op), ...decimalNodes(b)],
      answer: ans,
      display: `${a} ${op === "*" ? "×" : op === "/" ? "÷" : op} ${b}`,
    };
  }
  // Fallback
  const a = "1.5", b = "2.5";
  return {
    kind, nodes: [...decimalNodes(a), opNode("+"), ...decimalNodes(b)],
    answer: { n: 4, d: 1 }, display: `${a} + ${b}`,
  };
};

const genMixed = (diff: Difficulty): GeneratedDecimal => {
  const ops: ("+" | "-" | "*" | "/")[] = diff === "easy"
    ? ["+", "-"]
    : diff === "medium" ? ["+", "-", "*"] : ["+", "-", "*", "/"];
  for (let attempt = 0; attempt < 60; attempt++) {
    const a = randDec(diff);
    const b = randDec(diff);
    const c = randDec(diff);
    const op1 = pick(ops);
    const op2 = pick(ops);
    const fa = decimalStringToFrac(a)!;
    const fb = decimalStringToFrac(b)!;
    const fc = decimalStringToFrac(c)!;
    // Evaluate left-to-right with precedence (* / before + -)
    const apply = (x: Frac, y: Frac, op: string): Frac | null => {
      if (op === "+") return reduce({ n: x.n * y.d + y.n * x.d, d: x.d * y.d });
      if (op === "-") return reduce({ n: x.n * y.d - y.n * x.d, d: x.d * y.d });
      if (op === "*") return reduce({ n: x.n * y.n, d: x.d * y.d });
      if (op === "/") {
        if (y.n === 0) return null;
        return reduce({ n: x.n * y.d, d: x.d * y.n });
      }
      return null;
    };
    let ans: Frac | null;
    if ((op1 === "*" || op1 === "/") && (op2 !== "*" && op2 !== "/")) {
      const left = apply(fa, fb, op1);
      if (!left) continue;
      ans = apply(left, fc, op2);
    } else if ((op2 === "*" || op2 === "/") && (op1 !== "*" && op1 !== "/")) {
      const right = apply(fb, fc, op2);
      if (!right) continue;
      ans = apply(fa, right, op1);
    } else {
      const left = apply(fa, fb, op1);
      if (!left) continue;
      ans = apply(left, fc, op2);
    }
    if (!ans || ans.n < 0) continue;
    if (Math.abs(ans.n / ans.d) > 1000) continue;
    const sym = (o: string) => o === "*" ? "×" : o === "/" ? "÷" : o;
    return {
      kind: "mixed",
      nodes: [
        ...decimalNodes(a), opNode(op1),
        ...decimalNodes(b), opNode(op2),
        ...decimalNodes(c),
      ],
      answer: ans,
      display: `${a} ${sym(op1)} ${b} ${sym(op2)} ${c}`,
    };
  }
  return buildArith("add", diff);
};

export const generateDecimal = (kind: DecimalKind, diff: Difficulty): GeneratedDecimal => {
  switch (kind) {
    case "frac-to-dec": return genFracToDec(diff);
    case "dec-to-frac": return genDecToFrac(diff);
    case "add":
    case "sub":
    case "mul":
    case "div":
      return buildArith(kind, diff);
    case "mixed": return genMixed(diff);
  }
};
