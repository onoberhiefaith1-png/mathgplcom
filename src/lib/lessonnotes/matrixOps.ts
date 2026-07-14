// Pure structural operations on a `mathStructure kind="matrix"` node. All
// operations preserve cell content; the software never evaluates numbers —
// only reshapes structure or writes textual expressions the teacher typed.

import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";

export type Bracket = "(" | "[" | "{" | "|";
export type MatrixTemplate =
  | "identity" | "zero" | "diagonal" | "scalar"
  | "upperTriangular" | "lowerTriangular" | "symmetric" | "augmented";

export interface MatrixAttrs {
  rows: number;
  cols: number;
  br: Bracket;
  divider?: number;
  locked?: boolean;
  template?: MatrixTemplate;
}

/** Find the nearest ancestor matrix at the current selection. */
export function findMatrix(editor: Editor): { pos: number; node: PMNode; attrs: MatrixAttrs } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const n = $from.node(d);
    if (n.type.name === "mathStructure" && (n.attrs.kind === "matrix")) {
      const raw = (n.attrs.attrs ?? {}) as Partial<MatrixAttrs>;
      const rows = Math.max(1, Number(raw.rows) || 0);
      const cols = Math.max(1, Number(raw.cols) || 0);
      if (!rows || !cols) return null;
      return {
        pos: $from.before(d),
        node: n,
        attrs: {
          rows,
          cols,
          br: (raw.br as Bracket) ?? "(",
          divider: typeof raw.divider === "number" ? raw.divider : undefined,
          locked: !!raw.locked,
          template: raw.template as MatrixTemplate | undefined,
        },
      };
    }
  }
  return null;
}

/** Read the current cell text from a slot node. */
function cellText(slot: PMNode): string {
  return slot.textContent ?? "";
}

/** Build a mathSlot JSON containing exactly `text`. Empty text = empty slot. */
function slotJson(text: string) {
  return text
    ? { type: "mathSlot", content: [{ type: "text", text }] }
    : { type: "mathSlot" };
}

/** Read cells into a rows×cols string grid (row-major). */
function readGrid(node: PMNode, attrs: MatrixAttrs): string[][] {
  const flat: string[] = [];
  node.forEach((slot) => flat.push(cellText(slot)));
  // Pad or truncate to match declared dims.
  while (flat.length < attrs.rows * attrs.cols) flat.push("");
  flat.length = attrs.rows * attrs.cols;
  const out: string[][] = [];
  for (let r = 0; r < attrs.rows; r++) {
    out.push(flat.slice(r * attrs.cols, (r + 1) * attrs.cols));
  }
  return out;
}

/** Rewrite the matrix node at `pos` with a new grid and (optional) attrs. */
function writeMatrix(
  editor: Editor,
  pos: number,
  node: PMNode,
  grid: string[][],
  attrs: MatrixAttrs,
) {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 1;
  const slots = grid.flat().map(slotJson);
  const newAttrs = {
    kind: "matrix",
    attrs: {
      rows,
      cols,
      br: attrs.br,
      ...(typeof attrs.divider === "number" ? { divider: attrs.divider } : {}),
      ...(attrs.locked ? { locked: true } : {}),
    },
  };
  const jsonNode = {
    type: "mathStructure",
    attrs: newAttrs,
    content: slots,
  };
  editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const type = state.schema.nodes.mathStructure;
      const created = type.createChecked(newAttrs, jsonNode.content.map((c: any) =>
        state.schema.nodeFromJSON(c),
      ));
      tr.replaceWith(pos, pos + node.nodeSize, created);
      return true;
    })
    .run();
}

/* ── structural ops ──────────────────────────────────────────────── */

export function addRow(editor: Editor, at: "above" | "below" = "below") {
  const m = findMatrix(editor);
  if (!m || m.attrs.locked) return;
  const grid = readGrid(m.node, m.attrs);
  const empty = Array.from({ length: m.attrs.cols }, () => "");
  const idx = at === "above" ? 0 : grid.length;
  grid.splice(idx, 0, empty);
  writeMatrix(editor, m.pos, m.node, grid, m.attrs);
}

export function deleteLastRow(editor: Editor) {
  const m = findMatrix(editor);
  if (!m || m.attrs.locked || m.attrs.rows <= 1) return;
  const grid = readGrid(m.node, m.attrs);
  grid.pop();
  writeMatrix(editor, m.pos, m.node, grid, m.attrs);
}

export function duplicateLastRow(editor: Editor) {
  const m = findMatrix(editor);
  if (!m || m.attrs.locked) return;
  const grid = readGrid(m.node, m.attrs);
  grid.push([...grid[grid.length - 1]]);
  writeMatrix(editor, m.pos, m.node, grid, m.attrs);
}

export function swapRows(editor: Editor, i: number, j: number) {
  const m = findMatrix(editor);
  if (!m || m.attrs.locked) return;
  const grid = readGrid(m.node, m.attrs);
  if (i < 0 || j < 0 || i >= grid.length || j >= grid.length) return;
  [grid[i], grid[j]] = [grid[j], grid[i]];
  writeMatrix(editor, m.pos, m.node, grid, m.attrs);
}

export function addColumn(editor: Editor, at: "left" | "right" = "right") {
  const m = findMatrix(editor);
  if (!m || m.attrs.locked) return;
  const grid = readGrid(m.node, m.attrs);
  const idx = at === "left" ? 0 : grid[0].length;
  for (const row of grid) row.splice(idx, 0, "");
  const attrs = { ...m.attrs };
  if (typeof attrs.divider === "number" && at === "left") attrs.divider += 1;
  writeMatrix(editor, m.pos, m.node, grid, attrs);
}

export function deleteLastColumn(editor: Editor) {
  const m = findMatrix(editor);
  if (!m || m.attrs.locked || m.attrs.cols <= 1) return;
  const grid = readGrid(m.node, m.attrs);
  for (const row of grid) row.pop();
  const attrs = { ...m.attrs };
  if (typeof attrs.divider === "number" && attrs.divider > grid[0].length) {
    attrs.divider = grid[0].length;
  }
  writeMatrix(editor, m.pos, m.node, grid, attrs);
}

export function swapColumns(editor: Editor, i: number, j: number) {
  const m = findMatrix(editor);
  if (!m || m.attrs.locked) return;
  const grid = readGrid(m.node, m.attrs);
  if (i < 0 || j < 0 || i >= m.attrs.cols || j >= m.attrs.cols) return;
  for (const row of grid) [row[i], row[j]] = [row[j], row[i]];
  writeMatrix(editor, m.pos, m.node, grid, m.attrs);
}

/* ── bracket / divider / lock ────────────────────────────────────── */

export function setBracket(editor: Editor, br: Bracket) {
  const m = findMatrix(editor);
  if (!m) return;
  const grid = readGrid(m.node, m.attrs);
  writeMatrix(editor, m.pos, m.node, grid, { ...m.attrs, br });
}

export function moveDivider(editor: Editor, delta: number) {
  const m = findMatrix(editor);
  if (!m || typeof m.attrs.divider !== "number") return;
  const next = Math.max(1, Math.min(m.attrs.cols - 1, m.attrs.divider + delta));
  const grid = readGrid(m.node, m.attrs);
  writeMatrix(editor, m.pos, m.node, grid, { ...m.attrs, divider: next });
}

export function removeDivider(editor: Editor) {
  const m = findMatrix(editor);
  if (!m) return;
  const grid = readGrid(m.node, m.attrs);
  const next: MatrixAttrs = { ...m.attrs };
  delete next.divider;
  writeMatrix(editor, m.pos, m.node, grid, next);
}

export function toggleLock(editor: Editor) {
  const m = findMatrix(editor);
  if (!m) return;
  const grid = readGrid(m.node, m.attrs);
  writeMatrix(editor, m.pos, m.node, grid, { ...m.attrs, locked: !m.attrs.locked });
}

/* ── templates ───────────────────────────────────────────────────── */

export function applyTemplate(editor: Editor, template: MatrixTemplate) {
  const m = findMatrix(editor);
  if (!m || m.attrs.locked) return;
  let { rows, cols } = m.attrs;
  const squareTemplates: MatrixTemplate[] = [
    "identity", "diagonal", "scalar",
    "upperTriangular", "lowerTriangular", "symmetric",
  ];
  if (squareTemplates.includes(template)) {
    const n = Math.max(rows, cols);
    rows = n; cols = n;
  }
  const grid = fillTemplate(template, rows, cols, readGrid(m.node, m.attrs));
  const attrs: MatrixAttrs = { ...m.attrs, rows, cols };
  if (template === "augmented") {
    attrs.divider = attrs.divider ?? Math.max(1, cols - 1);
  }
  writeMatrix(editor, m.pos, m.node, grid, attrs);
}

function fillTemplate(t: MatrixTemplate, rows: number, cols: number, existing: string[][]): string[][] {
  const at = (r: number, c: number) => existing[r]?.[c] ?? "";
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      switch (t) {
        case "identity":         row.push(r === c ? "1" : "0"); break;
        case "zero":             row.push("0"); break;
        case "diagonal":         row.push(r === c ? at(r, c) || "" : "0"); break;
        case "scalar":           row.push(r === c ? "k" : "0"); break;
        case "upperTriangular":  row.push(r <= c ? (at(r, c) || "") : "0"); break;
        case "lowerTriangular":  row.push(r >= c ? (at(r, c) || "") : "0"); break;
        case "symmetric":        row.push(r <= c ? (at(r, c) || "") : (at(c, r) || "")); break;
        case "augmented":        row.push(at(r, c) || ""); break;
      }
    }
    grid.push(row);
  }
  return grid;
}

/* ── row operation (symbolic, never evaluated) ────────────────────── */

/**
 * Apply a row combination like `R2 = R2 - 3*R1` or `R3 = R3 + 2R1 - R2`.
 * Each target-row cell is REPLACED with the literal string combination of
 * the source cells — the software never simplifies. Parentheses are added
 * around multi-token cells to preserve intent.
 */
export function applyRowOperation(editor: Editor, expression: string) {
  const m = findMatrix(editor);
  if (!m || m.attrs.locked) return { ok: false, error: "No matrix selected." };
  const parsed = parseRowOp(expression, m.attrs.rows);
  if (!parsed) return { ok: false, error: "Use form: R2 = R2 - 3R1" };
  const grid = readGrid(m.node, m.attrs);
  const target = parsed.target - 1;
  const newRow: string[] = [];
  for (let c = 0; c < m.attrs.cols; c++) {
    const parts: string[] = [];
    parsed.terms.forEach((term, idx) => {
      const cell = (grid[term.row - 1]?.[c] || "0").trim();
      const wrapped = /[+\-\s]/.test(cell) && cell.length > 1 ? `(${cell})` : cell;
      const coef = term.coef;
      const abs = coef.startsWith("-") ? coef.slice(1) : coef;
      const sign = coef.startsWith("-") ? "-" : (idx === 0 ? "" : "+");
      const body = abs === "1" || abs === "" ? wrapped : `${abs}·${wrapped}`;
      parts.push(idx === 0 ? `${sign}${body}` : ` ${sign} ${body}`);
    });
    newRow.push(parts.join("").replace(/^\+/, "").trim());
  }
  grid[target] = newRow;
  writeMatrix(editor, m.pos, m.node, grid, m.attrs);
  return { ok: true };
}

interface RowOpTerm { coef: string; row: number }
interface RowOp { target: number; terms: RowOpTerm[] }

function parseRowOp(expr: string, maxRow: number): RowOp | null {
  // Normalise unicode minus.
  const s = expr.replace(/[−–—]/g, "-").replace(/\*/g, "").trim();
  const eq = s.match(/^R\s*(\d+)\s*=\s*(.+)$/i);
  if (!eq) return null;
  const target = Number(eq[1]);
  if (!target || target > maxRow) return null;
  const rhs = eq[2];
  // Split into signed terms: e.g. "R2 - 3R1 + (1/2)R3"
  const terms: RowOpTerm[] = [];
  const re = /([+-]?\s*(?:\([^)]*\)|[\d./]*))\s*R\s*(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(rhs)) !== null) {
    let coef = (match[1] || "").replace(/\s+/g, "");
    const row = Number(match[2]);
    if (!row || row > maxRow) return null;
    if (coef === "" || coef === "+") coef = "1";
    else if (coef === "-") coef = "-1";
    // Strip surrounding parens for clean coefficients.
    if (/^\(.*\)$/.test(coef)) coef = coef.slice(1, -1);
    terms.push({ coef, row });
  }
  return terms.length ? { target, terms } : null;
}
