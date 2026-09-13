// TABLE STANDARD — teaches the generator WHEN mathematics is a table, and
// deterministically converts any hand-typed table it still produces into the
// platform's real Smart Table directive.
//
// The application already owns the table (Smart Table node + the
// [[tool:smartTable headers="…" rows="…"]] directive and its materializer).
// Nothing here builds a second table system: it only makes sure the AI reaches
// for the one that exists.

export const TABLE_RECOGNITION_STANDARD = `
TABLE RECOGNITION LAW (mandatory, every topic)

Whenever mathematical information is naturally organised into rows and columns,
you MUST emit ONE real table object:
  [[tool:smartTable headers="Col 1 | Col 2 | Col 3" rows="a | b | c ; d | e | f"]]

NEVER produce a table as:
  • | x | f | fx |            (pipe rows)
  • \\begin{array}{|c|c|}…      (array / tabular environments)
  • +----+----+ ASCII rules
  • space- or tab-aligned columns
  • a paragraph pretending to be a table ("x = 1, f = 3; x = 2, f = 5 …")
Column headings, computed columns, units, subtotals and totals belong INSIDE
the table cells — never described in prose.

THE TRIGGER IS THE MATHEMATICAL STRUCTURE, NOT THE WORD "TABLE".
If the mathematics has repeated entries each carrying the same set of values, it
is a table even when the word "table" never appears. Examples:
  • "find y when x = -2, -1, 0, 1, 2"          → x / y table of values
  • "calculate x² and fx for each frequency"    → x | f | fx | x² | fx² table
  • "list the factors of both numbers"          → factor table
  • "look up the logarithm of each number"      → log / antilog table
  • "record the distance travelled each hour"   → time / distance table

TOPICS WHERE A TABLE IS THE CORRECT REPRESENTATION (not exhaustive):
  • Number & arithmetic — multiplication/division/addition tables, factors,
    multiples, primes, HCF, LCM, factorisation, squares, cubes, roots, powers,
    number properties.
  • Algebra & functions — tables of values, substitution, input/output,
    function values, variation, algebraic relationships.
  • Sequences — term number vs term, first and second differences, nth-term
    working.
  • Logarithms — logarithm and antilogarithm tables, characteristic/mantissa,
    multiplication, division, powers and roots worked through logarithms.
  • Trigonometry — sine, cosine, tangent and standard-angle ratio tables,
    angle vs value tables.
  • Statistics — frequency, grouped frequency, extended frequency, cumulative
    frequency, class intervals, midpoints, and x | f | fx | x² | fx² working.
  • Probability — outcome tables, sample-space grids, two-way tables,
    probability distributions.
  • Coordinate geometry & graphs — x/y value tables, coordinate lists, plotting
    tables, transformation tables.
  • Geometry, measurement & mensuration — property tables, angle and side
    tables, area/perimeter/volume/surface-area comparisons, formula tables,
    dimension tables.
  • Conversions — unit, metric and currency conversion tables.
  • Financial mathematics — interest, depreciation, investment, repayment,
    profit/loss and percentage tables.
  • Applied mathematics — distance/time/speed, work rate, ratio and proportion,
    experimental data and comparison tables.
  • Data handling — raw data, organised data, tallies, distributions.
A matrix or determinant is NOT a Smart Table: emit it as the matrix structure.

EVERY value inside a table must be mathematically correct, and mathematical
notation inside cells stays real mathematics (powers, fractions, roots, symbols,
units, negatives, percentages) — write fx² as fx^{2}, never as broken markup.
`.trim();

/* ------------------------------------------------------------------ *
 * Detection + deterministic conversion
 * ------------------------------------------------------------------ */

export type DetectedTable = { headers: string[]; rows: string[][] };

const DIRECTIVE_RE = /\[\[tool:[^\]]*\]\]/;
const RULER_RE = /^[ \t]*[+|]?[ \t]*:?[-=]{2,}:?[ \t]*(?:[+|][ \t]*:?[-=]{2,}:?[ \t]*)*[+|]?[ \t]*$/;
const ARRAY_ENV_RE = /\\begin\{(array|tabular)\}(?:\s*\{[^}]*\})?([\s\S]*?)\\end\{\1\}/g;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Split a pipe row into cells, preserving interior blanks. */
function pipeCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map(clean);
}

const isRuler = (line: string) => RULER_RE.test(line) && /[-=]{2,}/.test(line);

/** Contiguous runs of pipe rows → tables. */
function detectPipeTables(text: string): DetectedTable[] {
  const found: DetectedTable[] = [];
  const lines = text.split("\n");
  let run: string[][] = [];

  const flush = () => {
    const rows = run.filter((r) => r.some((c) => c.length > 0));
    run = [];
    if (rows.length < 2) return;
    const width = rows[0]!.length;
    if (width < 2) return;
    if (!rows.every((r) => r.length === width)) return;
    found.push({ headers: rows[0]!, rows: rows.slice(1) });
  };

  for (const line of lines) {
    if (DIRECTIVE_RE.test(line)) { flush(); continue; }
    if (isRuler(line)) continue; // markdown / ASCII separator inside a run
    const bars = (line.match(/\|/g) || []).length;
    if (bars >= 2 || (bars === 1 && run.length > 0)) {
      run.push(pipeCells(line));
      continue;
    }
    flush();
  }
  flush();
  return found;
}

/** \begin{array}{|c|c|} … \end{array} → table. */
function detectArrayTables(text: string): DetectedTable[] {
  const found: DetectedTable[] = [];
  ARRAY_ENV_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ARRAY_ENV_RE.exec(text))) {
    const body = m[2] ?? "";
    const rows = body
      .split(/\\\\/)
      .map((r) => r.replace(/\\hline/g, "").trim())
      .filter((r) => r.length > 0)
      .map((r) => r.split("&").map(clean));
    const solid = rows.filter((r) => r.some((c) => c.length > 0));
    if (solid.length < 2) continue;
    const width = solid[0]!.length;
    if (width < 2) continue;
    if (!solid.every((r) => r.length === width)) continue;
    found.push({ headers: solid[0]!, rows: solid.slice(1) });
  }
  return found;
}

/** Space-aligned numeric columns — reported, never auto-converted. */
function hasAlignedColumns(text: string): boolean {
  const lines = text.split("\n").filter((l) => !DIRECTIVE_RE.test(l));
  let run = 0;
  let width = 0;
  for (const line of lines) {
    const cells = line.trim().split(/[ \t]{2,}|\t/).map(clean).filter(Boolean);
    const numericish = cells.filter((c) => /^[-−]?[\d.,/^{}()x²³]+$/i.test(c)).length;
    if (cells.length >= 3 && numericish >= 2) {
      if (width === 0 || cells.length === width) { width = cells.length; run++; }
      else { width = cells.length; run = 1; }
      if (run >= 3) return true;
    } else { run = 0; width = 0; }
  }
  return false;
}

const escapeParam = (s: string) => s.replace(/"/g, "'").replace(/[|;]/g, "/");

/** Render one detected table as the platform directive. */
export function tableDirective(t: DetectedTable): string {
  const headers = t.headers.map(escapeParam).join(" | ");
  const rows = t.rows.map((r) => r.map(escapeParam).join(" | ")).join(" ; ");
  return `[[tool:smartTable headers="${headers}" rows="${rows}"]]`;
}

/** All hand-typed tables in a draft (pipe rows + array environments). */
export function detectHandTables(text: string): DetectedTable[] {
  if (!text) return [];
  return [...detectArrayTables(text), ...detectPipeTables(text)];
}

/**
 * Deterministically rewrite unmistakable hand-typed tables into Smart Table
 * directives. Runs on the RAW draft, before markdown clean-up can flatten the
 * pipes and hide the evidence. Ambiguous / single-column content is untouched.
 */
export function convertHandTables(text: string): string {
  if (!text) return "";
  let out = text;

  // 1. array / tabular environments.
  out = out.replace(ARRAY_ENV_RE, (whole, _env: string, body: string) => {
    const [t] = detectArrayTables(`\\begin{array}${body}\\end{array}`.replace("{array}", "{array}{}"));
    const rows = body
      .split(/\\\\/)
      .map((r) => r.replace(/\\hline/g, "").trim())
      .filter(Boolean)
      .map((r) => r.split("&").map(clean))
      .filter((r) => r.some((c) => c.length > 0));
    const width = rows[0]?.length ?? 0;
    if (rows.length >= 2 && width >= 2 && rows.every((r) => r.length === width)) {
      return `\n${tableDirective({ headers: rows[0]!, rows: rows.slice(1) })}\n`;
    }
    return t ? `\n${tableDirective(t)}\n` : whole;
  });

  // 2. contiguous pipe-row blocks.
  const lines = out.split("\n");
  const result: string[] = [];
  let run: string[] = [];

  const flushRun = () => {
    if (!run.length) { return; }
    const cells = run.map(pipeCells).filter((r) => r.some((c) => c.length > 0));
    const width = cells[0]?.length ?? 0;
    if (cells.length >= 2 && width >= 2 && cells.every((r) => r.length === width)) {
      result.push(tableDirective({ headers: cells[0]!, rows: cells.slice(1) }));
    } else {
      result.push(...run);
    }
    run = [];
  };

  for (const line of lines) {
    if (DIRECTIVE_RE.test(line)) { flushRun(); result.push(line); continue; }
    if (run.length && isRuler(line)) continue;
    const bars = (line.match(/\|/g) || []).length;
    if (bars >= 2 || (bars === 1 && run.length > 0)) { run.push(line); continue; }
    flushRun();
    result.push(line);
  }
  flushRun();
  return result.join("\n");
}

/**
 * Table problems that remain after conversion — used to force a corrective
 * round instead of letting a flattened pseudo-table reach the note.
 */
export function tableViolations(text: string): string[] {
  const out: string[] = [];
  if (!text) return out;
  const rest = text.replace(/\[\[tool:[^\]]*\]\]/g, "");
  if (detectHandTables(rest).length) {
    out.push("A table was typed by hand (pipe rows / array environment). Emit ONE [[tool:smartTable headers=\"…\" rows=\"…\"]] directive instead.");
  } else if (/\\begin\{(array|tabular)\}/.test(rest) || /(^|\n)[ \t]*\|/.test(rest)) {
    out.push("A partial hand-made table structure is present. Rebuild it as one [[tool:smartTable …]] directive with complete headers and rows.");
  }
  if (hasAlignedColumns(rest)) {
    out.push("Rows and columns were aligned with spaces. That is a table: emit [[tool:smartTable …]] with real headers and rows.");
  }
  return out;
}

export function tableCorrection(problems: string[]): string {
  return [
    "Your output represented tabular mathematics as text.",
    ...problems.map((p) => `• ${p}`),
    "",
    TABLE_RECOGNITION_STANDARD,
    "",
    "Rewrite the SAME content. Every row-and-column structure becomes ONE",
    "[[tool:smartTable headers=\"…\" rows=\"…\"]] directive on its own line, with",
    "every heading, computed column, unit and total inside the cells. Keep all",
    "mathematics and every value identical.",
  ].join("\n");
}
