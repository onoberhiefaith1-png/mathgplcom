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
  // Rounded answers (0.33, 33.3) match working to their own decimal places.
  const dp = (num(b).split(".")[1] ?? "").length;
  const tol = dp > 0 ? 0.5 * 10 ** -dp + 1e-9 : 1e-6;
  return Math.abs(Number(a) - Number(num(b))) <= tol;
};

/** Calculated columns that are not deviation / fx families. */
const derivedKind = (h: string): "cf" | "rf" | "pct" | "angle" | "rule" | null => {
  const n = norm(h);
  if (/^(cf|c\.f\.?|cumulativefrequency|cumulativefreq|cumfreq)/.test(n)) return "cf";
  if (/^(relativefrequency|relfreq|rf|probability)/.test(n)) return "rf";
  if (/^(percentage|percent|%)/.test(n) || /\(%\)$/.test(n)) return "pct";
  if (/^(angle|sectorangle|angleofsector|degrees)/.test(n)) return "angle";
  if (/^y=.*x/.test(n)) return "rule";
  return null;
};

/** Heading kinds for deviation columns: x − x̄, (x − x̄)², f(x − x̄)². */
const devKind = (h: string): "dev" | "dev2" | "fdev2" | "abs" | null => {
  const n = norm(h)
    .replace(/barx|overlinex|x̄|μ|mu|mean/g, "M")
    .replace(/[−–—]/g, "-");
  if (/^\|x-M\|$/.test(n)) return "abs";
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
  const dkinds = headers.map(derivedKind);
  const fTotal = fi >= 0 && cells.every((row) => isNum(row[fi]))
    ? cells.reduce((t, row) => t + Number(num(row[fi])), 0) : null;
  const out: Subcells = {};
  cells.forEach((row, r) => {
    const put = (c: number, expr: string) => {
      const answer = row[c] ?? "";
      if (same(evalExpr(expr), answer)) out[`${r}:${c}`] = { expr, expected: num(answer) };
    };
    kinds.forEach((k, c) => {
      if (k === "abs" && xi >= 0 && mean !== undefined && isNum(row[xi])) {
        put(c, `|${wrap(row[xi])} − ${wrap(String(mean))}|`);
      } else if (k === "dev" && xi >= 0 && mean !== undefined && isNum(row[xi])) {
        put(c, `${wrap(row[xi])} − ${wrap(String(mean))}`);
      } else if (k === "dev2") {
        if (devi >= 0 && isNum(row[devi])) put(c, `${wrap(row[devi])}^{2}`);
      } else if (k === "fdev2" && fi >= 0 && isNum(row[fi])) {
        if (dev2i >= 0 && isNum(row[dev2i])) put(c, `${wrap(row[fi])} × ${wrap(row[dev2i])}`);
      }
    });
    dkinds.forEach((k, c) => {
      if (!k || kinds[c]) return;
      const f = fi >= 0 && isNum(row[fi]) ? wrap(row[fi]) : null;
      if (k === "cf" && f) {
        const prev = r > 0 ? cells[r - 1]?.[c] : null;
        if (r === 0) put(c, f);
        else if (prev && isNum(prev)) put(c, `${wrap(prev)} + ${f}`);
      } else if (k === "rf" && f && fTotal) put(c, `${f} ÷ ${fTotal}`);
      else if (k === "pct" && f && fTotal) put(c, `${f} ÷ ${fTotal} × 100`);
      else if (k === "angle" && f && fTotal) put(c, `${f} ÷ ${fTotal} × 360`);
      else if (k === "rule" && xi >= 0 && isNum(row[xi])) {
        const rhs = String(headers[c]).split("=").slice(1).join("=").replace(/\s+/g, "");
        const v = `(${num(row[xi])})`;
        const expr = rhs
          .replace(/(\d)x/g, `$1 × ${v}`)
          .replace(/x\^\{?(\d)\}?/g, `${v}^{$1}`)
          .replace(/x/g, v)
          .replace(/\*/g, " × ");
        put(c, expr);
      }
    });
    sym.forEach((s, c) => {
      if (kinds[c] || dkinds[c]) return;
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
      if (hits === 0 && Array.isArray(b.headers) && !Object.keys(b.subcells ?? {}).length) {
        b.subcells = deriveSubcells(b.headers, b.cells);
      }
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


/**
 * Whole-column rule: a column that is calculated in some rows must carry its
 * working in every row. Returns plain-language problems for gapped columns.
 */
export function subcellViolations(headers: string[], cells: string[][], subcells?: Subcells): string[] {
  const subs = subcells ?? deriveSubcells(headers, cells);
  const problems: string[] = [];
  headers.forEach((h, c) => {
    const filled = cells.filter((row) => String(row[c] ?? "").trim());
    const withWork = cells.filter((_, r) => subs[`${r}:${c}`]).length;
    if (withWork > 0 && withWork < filled.length) {
      problems.push(`Column "${h}": ${filled.length - withWork} row(s) have an answer that does not match its working.`);
    }
  });
  return problems;
}
