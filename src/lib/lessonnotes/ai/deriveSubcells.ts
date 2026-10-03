// Calculation Subcells for AI-generated statistics tables.
//
// Deterministic: the working is derived from the column headings (fx, x²,
// fx², midpoint) and the row's own values, then VERIFIED against the cell's
// answer. Any working that does not reproduce the answer is dropped — the
// answers themselves are never touched. Source-data columns get no working.

import { tryEvaluate } from "@/components/lessonnotes/extensions/visuals/smarttable/evaluator";

export type Subcells = Record<string, { expr: string; expected: string }>;

const norm = (h: string) =>
  String(h ?? "")
    .toLowerCase()
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\^\{?2\}?/g, "²")
    .replace(/[\s\\{}$]/g, "")
    .replace(/[×·*]/g, "");

/** Short symbol a heading stands for: "Number of goals (x)" → "x". */
const symbolOf = (h: string): string => {
  const n = norm(h);
  const paren = /\(([^()]+)\)$/.exec(n);
  if (paren) return paren[1];
  if (/^(midpoint|mid-point|classmark)/.test(n)) return "x";
  if (/^frequency/.test(n)) return "f";
  return n;
};

const num = (v: string) => String(v ?? "").trim().replace(/−/g, "-");
const isNum = (v: string) => /^-?\d+(\.\d+)?$/.test(num(v));
const wrap = (v: string) => (num(v).startsWith("-") ? `(${num(v)})` : num(v));
const interval = (v: string) => /^\s*(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(v ?? ""));

const evalExpr = (expr: string) =>
  tryEvaluate("=" + expr.replace(/\^\{(\d+)\}/g, "^$1").replace(/[{}]/g, ""));

const same = (a: string | null, b: string) => {
  if (a === null || !isNum(b)) return false;
  return Math.abs(Number(a) - Number(num(b))) < 1e-6;
};

export function deriveSubcells(headers: string[], cells: string[][]): Subcells {
  const sym = headers.map(symbolOf);
  const col = (s: string) => sym.indexOf(s);
  const xi = col("x");
  const fi = col("f");
  const x2i = col("x²");
  const out: Subcells = {};
  cells.forEach((row, r) => {
    const put = (c: number, expr: string) => {
      const answer = row[c] ?? "";
      if (same(evalExpr(expr), answer)) out[`${r}:${c}`] = { expr, expected: num(answer) };
    };
    sym.forEach((s, c) => {
      if (s === "x" && xi === c) {
        // Midpoint from a class interval in an earlier column.
        const ivCol = row.findIndex((v, cc) => cc !== c && !!interval(v));
        const m = ivCol >= 0 ? interval(row[ivCol]) : null;
        if (m) put(c, `(${m[1]} + ${m[2]}) ÷ 2`);
        return;
      }
      if ((s === "fx" || s === "xf") && xi >= 0 && fi >= 0 && isNum(row[xi]) && isNum(row[fi])) {
        put(c, `${wrap(row[fi])} × ${wrap(row[xi])}`);
      } else if (s === "x²" && xi >= 0 && isNum(row[xi])) {
        put(c, `${wrap(row[xi])}^{2}`);
      } else if ((s === "fx²" || s === "x²f") && fi >= 0 && isNum(row[fi])) {
        if (x2i >= 0 && isNum(row[x2i])) put(c, `${wrap(row[fi])} × ${wrap(row[x2i])}`);
        else if (xi >= 0 && isNum(row[xi])) put(c, `${wrap(row[fi])} × ${wrap(row[xi])}^{2}`);
      }
    });
  });
  return out;
}
