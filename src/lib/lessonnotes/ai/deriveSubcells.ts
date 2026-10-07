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

const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const evalExpr = (expr: string) =>
  tryEvaluate("=" + expr
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((ch) => SUP[ch]).join(""))
    .replace(/[−–]/g, "-").replace(/×|\\times/g, "*").replace(/÷|\\div/g, "/")
    .replace(/\^\{(\d+)\}/g, "^$1").replace(/[{}]/g, ""));

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
  const isWork = (e: string) => {
    const t = String(e ?? "").trim();
    return !/^[-−]?\d+(\.\d+)?$/.test(t) && /[-−+×*÷/^²³√()]/.test(t);
  };
  // Pair a working table with its answer table (same shape, within a few
  // blocks, either order). The working folds into the answer table's
  // Subcells and the static working table is dropped: ONE table.
  const fold = (work: any, ans: any) => {
    const subs: Subcells = { ...(ans.subcells ?? {}) };
    let hits = 0;
    work.cells.forEach((row: string[], r: number) => row.forEach((expr: string, c: number) => {
      const v = String(ans.cells[r]?.[c] ?? "");
      if (!expr || expr.trim() === v.trim() || !isWork(expr)) return;
      if (same(evalExpr(expr), v)) { subs[`${r}:${c}`] = { expr, expected: num(v) }; hits++; }
    }));
    if (!hits) return false;
    ans.subcells = subs;
    ans.advanced = true;
    return true;
  };
  const drop = new Set<number>();
  for (let i = 0; i < nodes.length; i++) {
    if (drop.has(i)) continue;
    const a = tableOf(nodes[i]);
    if (!a) continue;
    for (let j = i + 1; j < Math.min(nodes.length, i + 6); j++) {
      if (drop.has(j)) continue;
      const b = tableOf(nodes[j]);
      if (!b || b.rows !== a.rows || b.cols !== a.cols) continue;
      if (fold(a, b)) { drop.add(i); break; }
      if (fold(b, a)) { drop.add(j); break; }
    }
  }
  // Same rows, different columns: a static data table followed by the
  // calculated table (or vice versa). The table whose headings are all
  // contained in the other is the copy — ONE table survives.
  const key = (h: string) => norm(h);
  const firstCol = (t: any) => (t.cells ?? []).map((r: string[]) => String(r?.[0] ?? "").trim()).join("|");
  for (let i = 0; i < nodes.length; i++) {
    if (drop.has(i)) continue;
    const a = tableOf(nodes[i]);
    if (!a || !Array.isArray(a.headers)) continue;
    for (let j = i + 1; j < Math.min(nodes.length, i + 8); j++) {
      if (drop.has(j)) continue;
      const b = tableOf(nodes[j]);
      if (!b || !Array.isArray(b.headers) || b.rows !== a.rows || firstCol(a) !== firstCol(b)) continue;
      const ha = a.headers.map(key), hb = b.headers.map(key);
      if (ha.every((h: string) => hb.includes(h))) { drop.add(i); break; }
      if (hb.every((h: string) => ha.includes(h))) { drop.add(j); }
    }
  }
  const out: T[] = [];
  nodes.forEach((n, i) => {
    if (drop.has(i)) return;
    const t = tableOf(n);
    if (t && Array.isArray(t.cells)) {
      // A lone working table: working becomes Subcells, answers are worked out.
      const subs: Subcells = { ...(t.subcells ?? {}) };
      let hits = 0;
      t.cells = t.cells.map((row: string[], r: number) => row.map((e: string, c: number) => {
        if (!e || !isWork(e)) return e;
        const v = evalExpr(e);
        if (v === null) return e;
        subs[`${r}:${c}`] = { expr: e, expected: num(v) }; hits++;
        return num(v);
      }));
      // Always complete every worked-out row from the column rules; working
      // the model already wrote is kept, missing rows are filled in.
      if (Array.isArray(t.headers)) {
        const d = deriveSubcells(t.headers, t.cells);
        for (const [k, v] of Object.entries(d)) if (!subs[k]) { subs[k] = v; hits++; }
      }
      if (hits) { t.subcells = subs; t.advanced = true; }
      if (!t.tableId) t.tableId = `tbl-${Math.random().toString(36).slice(2, 10)}`;
    }
    out.push(n);
  });
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


/** TABLE COMPLETE: every worked-out column carries working in every row. */
export function tableProblems(headers: string[], cells: string[][], subcells: Subcells = {}): string[] {
  const probs = [...subcellViolations(headers, cells, subcells)];
  const d = deriveSubcells(headers, cells);
  for (const k of Object.keys(d)) {
    if (!subcells[k]) {
      const [r, c] = k.split(":").map(Number);
      probs.push(`Row ${r + 1}, column "${headers[c] ?? c + 1}" is missing its working.`);
    }
  }
  return [...new Set(probs)];
}
export const tableComplete = (h: string[], c: string[][], s?: Subcells) => tableProblems(h, c, s).length === 0;

/** Accept an AI repair only where its working really gives the answer. */
export function verifiedRepair(headers: string[], cells: string[][], proposed: Record<string, string>, existing: Subcells = {}): Subcells {
  const out: Subcells = { ...existing };
  for (const [k, expr] of Object.entries(proposed ?? {})) {
    const [r, c] = k.split(":").map(Number);
    const ans = cells[r]?.[c];
    if (ans == null || !expr) continue;
    if (same(evalExpr(String(expr)), ans)) out[k] = { expr: String(expr), expected: num(ans) };
  }
  for (const [k, v] of Object.entries(deriveSubcells(headers, cells))) if (!out[k]) out[k] = v;
  return out;
}

/**
 * Split mixed cells: "4 − 6 = −2" → Subcell "4 − 6", result "−2". A cell that
 * holds only working ("2 − 6") gets its result calculated. Raw numbers and
 * text are untouched; working is kept only when it reproduces the result.
 */
export function normalizeTable(headers: string[], cells: string[][], subcells: Subcells = {}) {
  const out = cells.map((r) => [...r]);
  const subs: Subcells = { ...subcells };
  out.forEach((row, r) => row.forEach((raw, c) => {
    const v = String(raw ?? "").trim();
    if (!v || isNum(v) || interval(v)) return;
    const parts = v.split("=").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const ans = parts[parts.length - 1];
      const expr = parts[parts.length - 2];
      if (isNum(ans)) {
        row[c] = ans;
        if (!subs[`${r}:${c}`] && same(evalExpr(expr), ans)) subs[`${r}:${c}`] = { expr, expected: num(ans) };
      }
      return;
    }
    if (/[−\-+×÷*/^²]/.test(v) && /\d/.test(v)) {
      const val = evalExpr(v);
      if (val !== null && Number.isFinite(Number(val))) {
        const ans = String(Math.round(Number(val) * 1e6) / 1e6);
        row[c] = ans;
        if (!subs[`${r}:${c}`]) subs[`${r}:${c}`] = { expr: v, expected: ans };
      }
    }
  }));
  return { cells: out, subcells: subs };
}

/** Local, free "Complete the table": normalise, derive every missing Subcell, re-check. */
export function repairTable(headers: string[], cells: string[][], subcells: Subcells = {}) {
  const n = normalizeTable(headers, cells, subcells);
  const derived = deriveSubcells(headers, n.cells);
  const out: Subcells = { ...n.subcells };
  for (const [k, v] of Object.entries(derived)) if (!out[k]) out[k] = v;
  const changed = new Set<string>();
  n.cells.forEach((row, r) => row.forEach((v, c) => {
    const k = `${r}:${c}`;
    if (v !== cells[r]?.[c] || out[k]?.expr !== subcells[k]?.expr) changed.add(k);
  }));
  return { headers, cells: n.cells, subcells: out, changed: [...changed], problems: tableProblems(headers, n.cells, out) };
}
