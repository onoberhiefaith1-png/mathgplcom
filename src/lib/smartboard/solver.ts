// FlowBoard symbol bank — strictly mathematically reachable objects only.
// The bank is hidden from the UI; the predictor draws from it to compose a
// single weighted stream. No full equations, no `x=k`, no random tokens.
//
//   L1 — raw objects: literals from the question + immediate arithmetic
//        consequences (sums/differences/products/integer quotients, expansion).
//   L2 — small combined chunks (ax, ±n, *n, /n, x/n) restricted to values
//        reachable from L1.
//   L3 — structure templates (handled by structures.ts; not enumerated here).

import { canonical, parseLin, solveX, fracToString, Frac } from "./canonical";

export type Layer = 1 | 2;

export type BankKind = "atom" | "chunk";

export type PathTag = "literal" | "expand" | "subtract" | "divide" | "multiply" | "isolate";

export interface BankEntry {
  ascii: string;       // text inserted on tap
  display: string;     // chip label
  kind: BankKind;
  layer: Layer;
  pathTag?: PathTag;
  /** True if this token appears verbatim in the original question. */
  isCoreLiteral?: boolean;
  /** Numeric value (when entry is a single number) — used by ranker. */
  value?: number;
  isCorrect: boolean;
}

const pretty = (s: string) =>
  s.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");

const isInt = (f: Frac) => f.d === 1;
const fInt = (f: Frac) => f.n;
const fStr = (f: Frac) => fracToString(f);

const isAtomAscii = (s: string) => /^(\d+|x|y|[+\-*/=()])$/.test(s);
const isChunkAscii = (s: string) =>
  /^-?\d+x$/.test(s)
  || /^x$/.test(s)
  || /^[+\-]\d+$/.test(s)
  || /^[*/]\d+$/.test(s)
  || /^x[/]\d+$/.test(s);

const containsEq = (s: string) => s.includes("=");

/** Build the question-scoped bank. */
export const buildBank = (questionAscii: string): {
  entries: BankEntry[];
  solutionAscii: string | null;
} => {
  const eq = questionAscii.indexOf("=");
  if (eq < 0) return { entries: [], solutionAscii: null };
  const lhsStr = questionAscii.slice(0, eq);
  const rhsStr = questionAscii.slice(eq + 1);

  const lhs = parseLin(lhsStr);
  const rhs = parseLin(rhsStr);
  const c = canonical(questionAscii);
  if (!lhs || !rhs || !c) return { entries: [], solutionAscii: null };

  const sol = solveX(c);
  const solAscii = sol ? fStr(sol) : null;

  const out: BankEntry[] = [];
  const seen = new Set<string>();
  const push = (e: Omit<BankEntry, "display"> & { display?: string }) => {
    if (containsEq(e.ascii) && e.ascii !== "=") return;
    if (e.layer === 1 && !isAtomAscii(e.ascii)) return;
    if (e.layer === 2 && !isChunkAscii(e.ascii)) return;
    const key = e.ascii + "|" + e.layer;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...e, display: e.display ?? pretty(e.ascii) });
  };

  // ---------- Question literals ----------
  const literalNums = (questionAscii.match(/\d+/g) || []).map(Number);
  const literalSet = new Set<number>(literalNums);

  // x is always a core literal.
  push({ ascii: "x", kind: "atom", layer: 1, pathTag: "literal", isCoreLiteral: true, isCorrect: true });
  // Operators present in the equation.
  const opsInQ = new Set<string>();
  for (const ch of questionAscii) if ("+-*/()".includes(ch)) opsInQ.add(ch);
  // ÷ and × never appear ascii but division template uses /.
  ["+", "-", "*", "/", "(", ")"].forEach((s) => {
    push({ ascii: s, kind: "atom", layer: 1, pathTag: "literal", isCoreLiteral: opsInQ.has(s), isCorrect: true });
  });
  push({ ascii: "=", kind: "atom", layer: 1, pathTag: "literal", isCoreLiteral: true, isCorrect: true });

  // Each literal number — multi-digit number AND its individual digits.
  literalNums.forEach((n) => {
    push({
      ascii: String(n), kind: "atom", layer: 1, value: n,
      pathTag: "literal", isCoreLiteral: true, isCorrect: true,
    });
    String(n).split("").forEach((d) => {
      push({ ascii: d, kind: "atom", layer: 1, value: Number(d), pathTag: "literal", isCorrect: true });
    });
  });

  // ---------- Reachable arithmetic (L1 derived) ----------
  const literalsArr = [...literalSet];
  const reachable = new Map<number, PathTag>();
  const addReach = (v: number, tag: PathTag) => {
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0 || v > 9999) return;
    if (literalSet.has(v)) return;
    if (!reachable.has(v)) reachable.set(v, tag);
  };
  // pairwise sums / differences / products
  for (let i = 0; i < literalsArr.length; i++) {
    for (let j = 0; j < literalsArr.length; j++) {
      const a = literalsArr[i], b = literalsArr[j];
      addReach(a + b, "subtract");
      addReach(a - b, "subtract");
      addReach(a * b, "expand");
      if (b !== 0 && a % b === 0) addReach(a / b, "divide");
    }
  }
  // canonical b (constant after collecting) and solution as reachable.
  if (isInt(c.b)) addReach(Math.abs(fInt(c.b)), "subtract");
  if (sol && isInt(sol)) addReach(Math.abs(fInt(sol)), "divide");

  // Cap derived values to keep the bank focused.
  const derived = [...reachable.entries()].slice(0, 10);
  derived.forEach(([v, tag]) => {
    push({
      ascii: String(v), kind: "atom", layer: 1, value: v,
      pathTag: tag, isCorrect: true,
    });
  });

  // ---------- L2 chunks ----------
  const coefs = new Set<number>();
  if (isInt(lhs.a) && fInt(lhs.a) !== 0) coefs.add(fInt(lhs.a));
  if (isInt(rhs.a) && fInt(rhs.a) !== 0) coefs.add(fInt(rhs.a));
  if (isInt(c.a)   && fInt(c.a)   !== 0) coefs.add(fInt(c.a));
  if (isInt(lhs.a) && isInt(rhs.a)) {
    const diff = fInt(lhs.a) - fInt(rhs.a);
    if (diff !== 0) coefs.add(diff);
  }

  coefs.forEach((k) => {
    if (k === 0 || k === -1) return;
    const ax = k === 1 ? "x" : `${k}x`;
    if (k === 1) return; // bare x already in L1
    push({ ascii: ax, kind: "chunk", layer: 2, pathTag: "isolate", isCoreLiteral: literalSet.has(Math.abs(k)), isCorrect: true });
  });

  // ±n / *n / /n chunks for literals AND key reachable values.
  const chunkNums = new Set<number>([...literalSet, ...reachable.keys()]);
  chunkNums.forEach((n) => {
    if (n === 0) return;
    const a = Math.abs(n);
    push({ ascii: `+${a}`, kind: "chunk", layer: 2, pathTag: "subtract", isCorrect: true });
    push({ ascii: `-${a}`, kind: "chunk", layer: 2, pathTag: "subtract", isCorrect: true });
  });

  coefs.forEach((k) => {
    const a = Math.abs(k);
    if (a <= 1) return;
    push({ ascii: `/${a}`, kind: "chunk", layer: 2, pathTag: "divide",   isCorrect: true });
    push({ ascii: `*${a}`, kind: "chunk", layer: 2, pathTag: "multiply", isCorrect: true });
  });

  // x/k chunk if a denominator appears in the question.
  const denomMatch = questionAscii.match(/x\s*\/\s*(\d+)/);
  if (denomMatch) {
    const k = Number(denomMatch[1]);
    push({ ascii: `x/${k}`, kind: "chunk", layer: 2, pathTag: "multiply", isCorrect: true });
    push({ ascii: `*${k}`,  kind: "chunk", layer: 2, pathTag: "multiply", isCorrect: true });
  }

  return { entries: out, solutionAscii: solAscii };
};
