// Column weights for a table drawn inside the Game's writing surface
// (fixed layout, 100% wide). They follow the Lesson Note / Academia rule:
// each column starts at its authored width (72px floor, the same floor
// tableGrid and gameTableScale use), and only grows when what is SHOWN in
// it (header or a cell) is wider. The width of what is shown is estimated
// from the visible glyphs, never the LaTeX source: `x - \bar{x}` shows five
// characters, not eleven.

const MIN_COLUMN_PX = 72;
/** Average advance of a (bold) glyph, as a fraction of the font size. */
const GLYPH_EM = 0.62;

/** Accents and wrappers whose argument is drawn in place, with no width of their own. */
const WRAPPERS = /\\(?:bar|overline|underline|hat|widehat|tilde|widetilde|vec|dot|ddot|mathbf|mathrm|mathit|boldsymbol|text|textbf|operatorname)\s*\{([^{}]*)\}/g;

/**
 * Approximate number of glyphs a maths string occupies once rendered.
 * Scripts count at about 0.7 of a glyph; a fraction is as wide as its
 * wider part; any other command (\sum, \mu, \sigma …) is one symbol.
 */
export function visibleMathLength(source: unknown): number {
  let s = String(source ?? "").trim();
  if (!s) return 0;
  s = s.replace(/\$+/g, "");
  for (let i = 0; i < 6 && WRAPPERS.test(s); i++) { WRAPPERS.lastIndex = 0; s = s.replace(WRAPPERS, "$1"); }
  WRAPPERS.lastIndex = 0;
  let extra = 0;
  // \frac{a}{b} → the wider of a and b.
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/, (_m, a: string, b: string) => {
      const wa = visibleMathLength(a); const wb = visibleMathLength(b);
      extra += Math.max(wa, wb);
      return "";
    });
    if (next === s) break;
    s = next;
  }
  // Superscripts and subscripts are drawn smaller.
  s = s.replace(/[\^_]\s*\{([^{}]*)\}|[\^_]\s*(\\[A-Za-z]+|.)/g, (_m, group: string | undefined, single: string | undefined) => {
    extra += 0.7 * visibleMathLength(group ?? single ?? "");
    return "";
  });
  s = s.replace(/\\[A-Za-z]+/g, "§").replace(/\\./g, "§").replace(/[{}]/g, "");
  const glyphs = [...s].filter((ch) => !/[\u0300-\u036f]/.test(ch)).length;
  return glyphs + extra;
}

export interface ColumnWeightGrid {
  cols: number;
  headers?: unknown[];
  colWidths?: unknown[];
  cells?: unknown[][];
}

/** Pixel weights, one per column; share them as percentages of the table width. */
export function fitColumnWeights(
  grid: ColumnWeightGrid,
  opts: { textSize: number; padX: number },
): number[] {
  const cols = Math.max(0, Number(grid.cols) || 0);
  const glyphPx = Math.max(9, opts.textSize) * GLYPH_EM;
  const pad = Math.max(0, opts.padX) * 2 + 2;
  return Array.from({ length: cols }, (_, c) => {
    const authored = Math.max(MIN_COLUMN_PX, Number(grid.colWidths?.[c]) || MIN_COLUMN_PX);
    let widest = visibleMathLength(grid.headers?.[c]);
    for (const row of grid.cells ?? []) widest = Math.max(widest, visibleMathLength(row?.[c]));
    const shown = widest > 0 ? Math.ceil(widest * glyphPx + pad) : 0;
    return Math.max(authored, shown);
  });
}
