// Smart Mathematical Tables catalog.
//
// Each entry describes one printed mathematical table — the kind found
// in WAEC/NECO/Cambridge math-tables books. The `generate` function
// returns the *exact* row a teacher would look up for the supplied
// input value, plus the column headings and (where applicable) a row of
// "mean difference" columns. Output is intentionally narrow — never the
// whole book — so the rendered table reads like a clipping straight out
// of the textbook.

export type TableCell = {
  text: string;
  /** Marks the cell the input's lookup lands on so the renderer can highlight it. */
  highlight?: boolean;
};

export type TableRow = {
  label: string;
  main: TableCell[];
  diff?: TableCell[];
};

export type GeneratedTable = {
  /** Headings above the main columns (e.g. "0 1 2 … 9"). */
  mainHeadings: string[];
  /** Headings above the difference columns ("1 2 … 9"). May be empty. */
  diffHeadings: string[];
  /** Row label header (e.g. "x", "θ°"). */
  rowLabelHeader: string;
  rows: TableRow[];
  /** Free-form explanation of how the lookup was performed. */
  lookupNote: string;
};

export type TableEntry = {
  id: string;
  section: "A" | "B";
  name: string;
  /** Inclusive valid input range, displayed to the teacher. */
  rangeLabel: string;
  /** Optional validator. Return null = ok, string = error message. */
  validate: (value: number) => string | null;
  generate: (value: number) => GeneratedTable;
};

// ----------------------------------------------------------------------------
// helpers

const fmt = (n: number, dp: number) => {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(dp);
};

/** 4-decimal mantissa string with the leading "0." stripped, the way printed log tables show it. */
const mantissa = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const frac = n - Math.floor(n);
  return frac.toFixed(4).slice(2); // ".7404" -> "7404"
};

const range10to99 = (v: number) =>
  v >= 10 && v < 100 ? null : "Enter a value between 10.00 and 99.99.";

const range1to10 = (v: number) =>
  v >= 1 && v < 10 ? null : "Enter a value between 1.00 and 9.99.";

const rangeAngle = (v: number) =>
  v >= 0 && v <= 90 ? null : "Enter an angle between 0° and 90°.";

// ----------------------------------------------------------------------------
// Generators that build a "row block": the row containing the input + its
// 0-9 main columns + 1-9 difference columns.

/**
 * Build a 4-figure mantissa-style table row for a value in [10, 100).
 * The input "55.24" expands as:
 *   row label = "55"
 *   main col k (k=0..9)  = mantissa( log10( 55.k ) ) but using two
 *                          significant digits — exactly how printed log
 *                          tables present rows.
 *   diff col d (d=1..9)  = mean difference for the 3rd decimal digit
 */
function buildMantissaRow(opts: {
  value: number;
  fn: (x: number) => number;
  /** True if function increases — controls diff sign. */
  // increasing not used directly; difference is always positive in printed tables.
  rowLabelHeader: string;
}): GeneratedTable {
  const { value, fn, rowLabelHeader } = opts;
  const whole = Math.floor(value * 10) / 10; // e.g. 55.24 -> 55.2
  const rowBase = Math.floor(value); // 55
  const tenthDigit = Math.round((whole - rowBase) * 10); // 2
  const hundredth = Math.round((value - whole) * 100); // 4

  const main: TableCell[] = [];
  for (let k = 0; k < 10; k++) {
    const v = rowBase + k / 10;
    main.push({
      text: mantissa(fn(v)),
      highlight: k === tenthDigit,
    });
  }

  // Mean differences: average increment per 0.01 between this row's first and
  // last value, scaled per difference column 1..9.
  const baseVal = fn(rowBase);
  const nextVal = fn(rowBase + 1);
  const perUnit = (nextVal - baseVal) / 100; // change per 0.01
  const diff: TableCell[] = [];
  for (let d = 1; d <= 9; d++) {
    const delta = Math.abs(perUnit * d);
    const digits = Math.round(delta * 10000); // mantissa-style integer
    diff.push({
      text: String(digits),
      highlight: d === hundredth,
    });
  }

  const mainHeadings = Array.from({ length: 10 }, (_, k) => String(k));
  const diffHeadings = Array.from({ length: 9 }, (_, k) => String(k + 1));

  return {
    mainHeadings,
    diffHeadings,
    rowLabelHeader,
    rows: [{ label: String(rowBase), main, diff }],
    lookupNote: `Row ${rowBase}, column ${tenthDigit}, diff ${hundredth}. Pick the highlighted main value, then add the highlighted difference.`,
  };
}

/**
 * Build a simple row table (no diff columns) — one row, ten columns,
 * each cell showing fn(rowBase + k/10) with `dp` decimal places.
 */
function buildSimpleRow(opts: {
  value: number;
  fn: (x: number) => number;
  rowLabelHeader: string;
  dp: number;
}): GeneratedTable {
  const { value, fn, rowLabelHeader, dp } = opts;
  const rowBase = Math.floor(value);
  const tenth = Math.round((value - rowBase) * 10);
  const main: TableCell[] = [];
  for (let k = 0; k < 10; k++) {
    main.push({ text: fmt(fn(rowBase + k / 10), dp), highlight: k === tenth });
  }
  return {
    mainHeadings: Array.from({ length: 10 }, (_, k) => String(k)),
    diffHeadings: [],
    rowLabelHeader,
    rows: [{ label: String(rowBase), main }],
    lookupNote: `Row ${rowBase}, column ${tenth}.`,
  };
}

/** Trig tables: rows are integer degrees, columns are 0' 6' 12' … 54' (each 6 minutes). */
function buildTrigRow(opts: {
  value: number;
  fn: (radians: number) => number;
  /** Whether to render as 4-figure mantissa-style (true for log-trig). */
  asMantissa?: boolean;
  rowLabelHeader: string;
}): GeneratedTable {
  const { value, fn, asMantissa, rowLabelHeader } = opts;
  const deg = Math.floor(value);
  const minutes = (value - deg) * 60;
  const colIdx = Math.min(9, Math.max(0, Math.round(minutes / 6))); // 0..9
  const headings = Array.from({ length: 10 }, (_, k) => `${k * 6}'`);
  const main: TableCell[] = [];
  for (let k = 0; k < 10; k++) {
    const θ = ((deg + (k * 6) / 60) * Math.PI) / 180;
    const v = fn(θ);
    main.push({
      text: asMantissa ? mantissa(v) : fmt(v, 4),
      highlight: k === colIdx,
    });
  }
  return {
    mainHeadings: headings,
    diffHeadings: [],
    rowLabelHeader,
    rows: [{ label: `${deg}°`, main }],
    lookupNote: `Row ${deg}°, column ${colIdx * 6}'.`,
  };
}

// ----------------------------------------------------------------------------
// Catalog

export const TABLE_CATALOG: TableEntry[] = [
  // ── Section A: Mathematical Tables ──────────────────────────────────────
  {
    id: "log",
    section: "A",
    name: "Logarithms of Numbers",
    rangeLabel: "10.00 – 99.99",
    validate: range10to99,
    generate: (v) =>
      buildMantissaRow({ value: v, fn: (x) => Math.log10(x), rowLabelHeader: "x" }),
  },
  {
    id: "antilog",
    section: "A",
    name: "Antilogarithms of Numbers",
    rangeLabel: "0.00 – 0.99",
    validate: (v) => (v >= 0 && v < 1 ? null : "Enter a mantissa between 0.00 and 0.99."),
    generate: (v) => {
      // Treat input as 0.AB and present antilog(0.AB + k/1000) style row.
      const value = v * 100; // 0.55 -> 55 (scaled like the printed table)
      return buildMantissaRow({
        value,
        fn: (x) => Math.pow(10, x / 100), // each tenth of the row = +0.001 in mantissa
        rowLabelHeader: ".x",
      });
    },
  },
  {
    id: "reciprocal",
    section: "A",
    name: "Reciprocals of Numbers",
    rangeLabel: "1.00 – 9.99",
    validate: range1to10,
    generate: (v) => buildSimpleRow({ value: v, fn: (x) => 1 / x, rowLabelHeader: "x", dp: 4 }),
  },
  {
    id: "square",
    section: "A",
    name: "Squares of Numbers",
    rangeLabel: "1.00 – 9.99",
    validate: range1to10,
    generate: (v) => buildSimpleRow({ value: v, fn: (x) => x * x, rowLabelHeader: "x", dp: 3 }),
  },
  {
    id: "sqrt",
    section: "A",
    name: "Square Roots of Numbers",
    rangeLabel: "1.00 – 99.99",
    validate: (v) => (v >= 1 && v < 100 ? null : "Enter a value between 1.00 and 99.99."),
    generate: (v) => buildSimpleRow({ value: v, fn: (x) => Math.sqrt(x), rowLabelHeader: "x", dp: 4 }),
  },
  {
    id: "cube",
    section: "A",
    name: "Cubes of Numbers",
    rangeLabel: "1.00 – 9.99",
    validate: range1to10,
    generate: (v) => buildSimpleRow({ value: v, fn: (x) => x * x * x, rowLabelHeader: "x", dp: 3 }),
  },
  {
    id: "ln",
    section: "A",
    name: "Natural Logarithms of Numbers",
    rangeLabel: "1.00 – 9.99",
    validate: range1to10,
    generate: (v) => buildSimpleRow({ value: v, fn: (x) => Math.log(x), rowLabelHeader: "x", dp: 4 }),
  },
  {
    id: "exp",
    section: "A",
    name: "Exponentials (eˣ)",
    rangeLabel: "0.00 – 9.99",
    validate: (v) => (v >= 0 && v < 10 ? null : "Enter a value between 0.00 and 9.99."),
    generate: (v) => buildSimpleRow({ value: v, fn: (x) => Math.exp(x), rowLabelHeader: "x", dp: 4 }),
  },
  {
    id: "exp-neg",
    section: "A",
    name: "Negative Exponentials (e⁻ˣ)",
    rangeLabel: "0.00 – 9.99",
    validate: (v) => (v >= 0 && v < 10 ? null : "Enter a value between 0.00 and 9.99."),
    generate: (v) => buildSimpleRow({ value: v, fn: (x) => Math.exp(-x), rowLabelHeader: "x", dp: 4 }),
  },
  {
    id: "sin",
    section: "A",
    name: "Sines of Angles",
    rangeLabel: "0° – 90°",
    validate: rangeAngle,
    generate: (v) => buildTrigRow({ value: v, fn: Math.sin, rowLabelHeader: "θ" }),
  },
  {
    id: "cos",
    section: "A",
    name: "Cosines of Angles",
    rangeLabel: "0° – 90°",
    validate: rangeAngle,
    generate: (v) => buildTrigRow({ value: v, fn: Math.cos, rowLabelHeader: "θ" }),
  },
  {
    id: "tan",
    section: "A",
    name: "Tangents of Angles",
    rangeLabel: "0° – 89°",
    validate: (v) => (v >= 0 && v < 90 ? null : "Enter an angle between 0° and 89°."),
    generate: (v) => buildTrigRow({ value: v, fn: Math.tan, rowLabelHeader: "θ" }),
  },
  {
    id: "log-sin",
    section: "A",
    name: "Logarithms of Sines",
    rangeLabel: "1° – 89°",
    validate: (v) => (v >= 1 && v < 90 ? null : "Enter an angle between 1° and 89°."),
    generate: (v) =>
      buildTrigRow({ value: v, fn: (r) => Math.log10(Math.sin(r)), asMantissa: true, rowLabelHeader: "θ" }),
  },
  {
    id: "log-cos",
    section: "A",
    name: "Logarithms of Cosines",
    rangeLabel: "0° – 89°",
    validate: (v) => (v >= 0 && v < 90 ? null : "Enter an angle between 0° and 89°."),
    generate: (v) =>
      buildTrigRow({ value: v, fn: (r) => Math.log10(Math.cos(r)), asMantissa: true, rowLabelHeader: "θ" }),
  },
  {
    id: "log-tan",
    section: "A",
    name: "Logarithms of Tangents",
    rangeLabel: "1° – 89°",
    validate: (v) => (v >= 1 && v < 90 ? null : "Enter an angle between 1° and 89°."),
    generate: (v) =>
      buildTrigRow({ value: v, fn: (r) => Math.log10(Math.tan(r)), asMantissa: true, rowLabelHeader: "θ" }),
  },
  {
    id: "deg-rad",
    section: "A",
    name: "Degree ↔ Radian Conversion",
    rangeLabel: "0° – 360°",
    validate: (v) => (v >= 0 && v <= 360 ? null : "Enter an angle between 0° and 360°."),
    generate: (v) => {
      const rowBase = Math.floor(v);
      const tenth = Math.round((v - rowBase) * 10);
      const main: TableCell[] = [];
      for (let k = 0; k < 10; k++) {
        const deg = rowBase + k / 10;
        main.push({ text: ((deg * Math.PI) / 180).toFixed(4), highlight: k === tenth });
      }
      return {
        mainHeadings: Array.from({ length: 10 }, (_, k) => String(k)),
        diffHeadings: [],
        rowLabelHeader: "°",
        rows: [{ label: String(rowBase), main }],
        lookupNote: `${v}° ≈ ${((v * Math.PI) / 180).toFixed(4)} rad.`,
      };
    },
  },
  // ── Section B: Statistical Tables ───────────────────────────────────────
  {
    id: "factorial",
    section: "B",
    name: "Logarithms of Factorials (lg x!)",
    rangeLabel: "1 – 100",
    validate: (v) =>
      v >= 1 && v <= 100 && Number.isInteger(v) ? null : "Enter a whole number between 1 and 100.",
    generate: (v) => {
      const n = Math.round(v);
      // Show n-2 .. n+2 rows; log10(n!) via log gamma using Stirling for safety.
      const lgFact = (k: number) => {
        let s = 0;
        for (let i = 2; i <= k; i++) s += Math.log10(i);
        return s;
      };
      const rows: TableRow[] = [];
      for (let k = Math.max(1, n - 2); k <= Math.min(100, n + 2); k++) {
        rows.push({
          label: String(k),
          main: [{ text: lgFact(k).toFixed(4), highlight: k === n }],
        });
      }
      return {
        mainHeadings: ["lg x!"],
        diffHeadings: [],
        rowLabelHeader: "x",
        rows,
        lookupNote: `lg ${n}! = ${lgFact(n).toFixed(4)}.`,
      };
    },
  },
  {
    id: "binomial",
    section: "B",
    name: "Binomial Coefficients",
    rangeLabel: "n = 0 – 20",
    validate: (v) =>
      v >= 0 && v <= 20 && Number.isInteger(v) ? null : "Enter a whole number between 0 and 20.",
    generate: (v) => {
      const n = Math.round(v);
      const choose = (a: number, b: number) => {
        if (b < 0 || b > a) return 0;
        let r = 1;
        for (let i = 1; i <= b; i++) r = (r * (a - i + 1)) / i;
        return Math.round(r);
      };
      const main: TableCell[] = [];
      for (let k = 0; k <= n; k++) main.push({ text: String(choose(n, k)) });
      return {
        mainHeadings: Array.from({ length: n + 1 }, (_, k) => `C(${n},${k})`),
        diffHeadings: [],
        rowLabelHeader: "n",
        rows: [{ label: String(n), main }],
        lookupNote: `Row n = ${n} of Pascal's triangle.`,
      };
    },
  },
];

export const SECTION_LABELS: Record<"A" | "B", string> = {
  A: "Section A — Mathematical Tables",
  B: "Section B — Statistical Tables",
};

export function findTable(id: string): TableEntry | undefined {
  return TABLE_CATALOG.find((t) => t.id === id);
}
