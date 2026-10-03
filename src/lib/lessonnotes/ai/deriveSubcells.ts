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

/** Heading kinds for deviation columns: x − x̄, (x − x̄)², f(x − x̄)². */
const devKind = (h: string): "dev" | "dev2" | "fdev2" | null => {
  const n = norm(h)
    .replace(/barx|overlinex|x̄|μ|mu|mean/g, "M")
    .replace(/[−–—]/g, "-");
  if (/^f\(x-M\)²$/.test(n) || /^\(x-M\)²f$/.test(n)) return "fdev2";
  if (/^\(x-M\)²$/.test(n) || /^d²$/.test(n)) return "dev2";
  if (/^x-M$/.test(n) || /^\(x-M\)$/.test(n) || /^d$/.test(n)) return "dev";
  return null;
};

export function deriveSubcells(headers: string[], cells: string[][], meanHint?: number): Subcells {
  const sym = headers.map(symbolOf);
  const col = (s: string) => sym.indexOf(s);
  const xi = col("x");
  const fi = col("f");
  const x2i = col("x²");
  const kinds = headers.map(devKind);
  const devi = kinds.indexOf("dev");
  const dev2i = kinds.indexOf("dev2");
  // Mean: from the solution if known, else inferred from row 0 (x − dev).
  let mean = meanHint;
  if (mean === undefined && xi >= 0 && devi >= 0) {
    const r0 = cells.find((row) => isNum(row[xi]) && isNum(row[devi]));
    if (r0) mean = Number(num(r0[xi])) - Number(num(r0[devi]));
  }
  const out: Subcells = {};
  cells.forEach((row, r) => {
    const put = (c: number, expr: string) => {
      const answer = row[c] ?? "";
      if (same(evalExpr(expr), answer)) out[`${r}:${c}`] = { expr, expected: num(answer) };
    };
    kinds.forEach((k, c) => {
      if (k === "dev" && xi >= 0 && mean !== undefined && isNum(row[xi])) {
        put(c, `${wrap(row[xi])} − ${wrap(String(mean))}`);
      } else if (k === "dev2") {
        if (devi >= 0 && isNum(row[devi])) put(c, `${wrap(row[devi])}^{2}`);
      } else if (k === "fdev2" && fi >= 0 && isNum(row[fi])) {
        if (dev2i >= 0 && isNum(row[dev2i])) put(c, `${wrap(row[fi])} × ${wrap(row[dev2i])}`);
      }
    });
    sym.forEach((s, c) => {
      if (kinds[c]) return;
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

/**
 * ONE TABLE law. When the model writes a working table followed by an answer
 * table with the same shape, fold the working into Subcells of the answer
 * table and drop the working table. Only rows whose working evaluates to the
 * answer are folded; if none match, nothing is merged.
 */
export function mergeWorkingTables<T extends { type: string; attrs?: any; content?: T[] }>(nodes: T[]): T[] {
  const tableOf = (n: T | undefined) => {
    const v = n?.type === "paragraph" ? n.content?.[0] : n;
    return v?.type === "mathVisual" && v.attrs?.family === "smarttable" ? v.attrs.attrs : null;
  };
  const out: T[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = tableOf(nodes[i]);
    const b = tableOf(nodes[i + 1]);
    if (a && b && a.rows === b.rows && a.cols === b.cols) {
      const subs: Subcells = { ...(b.subcells ?? {}) };
      let hits = 0, misses = 0;
      a.cells.forEach((row: string[], r: number) => row.forEach((expr: string, c: number) => {
        const ans = b.cells[r]?.[c] ?? "";
        if (!expr || expr.trim() === ans.trim()) return;
        if (same(evalExpr(expr), ans)) { subs[`${r}:${c}`] = { expr, expected: num(ans) }; hits++; }
        else misses++;
      }));
      if (hits > 0 && misses === 0) {
        b.subcells = subs;
        b.advanced = true;
        continue; // drop the working table
      }
    }
    out.push(nodes[i]);
  }
  return out;
}

