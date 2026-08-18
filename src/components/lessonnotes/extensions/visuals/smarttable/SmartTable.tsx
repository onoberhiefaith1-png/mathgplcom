// Smart Table — a single editable data grid. Quick row/column controls sit
// directly under the table; the Edit button opens the universal right-hand
// Properties Panel. The table is high-contrast and readable by default.

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Minus, Plus, Settings2, Sigma } from "lucide-react";
import { evaluate, formatNumber, tryEvaluate, cellNumber } from "./evaluator";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { useAiEditBridge } from "@/hooks/useAiEditBridge";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";
import { latexToFriendly } from "@/lib/notebook/mathFriendly";
import { detectSelectionKindFromText } from "@/lib/lessonnotes/detectSelectionKind";
import { toast } from "@/hooks/use-toast";
import { SmartTableCellToolbar } from "./SmartTableCellToolbar";
import { MathInlineCanvas } from "@/components/lessonnotes/extensions/MathInlineCanvas";
import { latexToTree, treeToLatex } from "@/lib/smartboard/mathTreeLatex";
import type { Row as MathRow } from "@/lib/smartboard/mathTree";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelColor, PanelToggle,
} from "@/components/lessonnotes/panel/panelPrimitives";


export interface SmartTableStyle {
  cellPadX: number;
  cellPadY: number;
  borderWidth: number;
  borderColor: string;
  opacity: number;
  blur: number;
  textSize: number;
  textAlign: "left" | "center" | "right";
  headerBold: boolean;
  striped: boolean;
  showGridlines: boolean;
  headerFill: string;
}

export interface SmartTableAttrs {
  rows: number;
  cols: number;
  headers: string[];
  cells: string[][];
  colWidths?: number[];
  style: SmartTableStyle;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 3;

// Defaults chosen for immediate readability on the paper background.
const DEFAULT_STYLE: SmartTableStyle = {
  cellPadX: 10,
  cellPadY: 8,
  borderWidth: 1,
  borderColor: "#1f2937",   // slate-800 — clearly visible on paper
  opacity: 1,
  blur: 0,
  textSize: 15,
  textAlign: "center",
  headerBold: true,
  striped: false,
  showGridlines: true,
  headerFill: "transparent",
};

function normalizeStyle(s: unknown): SmartTableStyle {
  const src = (s && typeof s === "object") ? (s as Record<string, unknown>) : {};
  const num = (k: keyof SmartTableStyle, d: number) =>
    Number.isFinite(Number(src[k])) ? Number(src[k]) : d;
  const str = (k: keyof SmartTableStyle, d: string) =>
    typeof src[k] === "string" ? (src[k] as string) : d;
  const bool = (k: keyof SmartTableStyle, d: boolean) =>
    typeof src[k] === "boolean" ? (src[k] as boolean) : d;
  const align = ["left", "center", "right"].includes(String(src.textAlign))
    ? (src.textAlign as SmartTableStyle["textAlign"])
    : DEFAULT_STYLE.textAlign;
  return {
    cellPadX: num("cellPadX", DEFAULT_STYLE.cellPadX),
    cellPadY: num("cellPadY", DEFAULT_STYLE.cellPadY),
    borderWidth: num("borderWidth", DEFAULT_STYLE.borderWidth),
    borderColor: str("borderColor", DEFAULT_STYLE.borderColor),
    opacity: Math.max(0, Math.min(1, num("opacity", DEFAULT_STYLE.opacity))),
    blur: num("blur", DEFAULT_STYLE.blur),
    textSize: num("textSize", DEFAULT_STYLE.textSize),
    textAlign: align,
    headerBold: bool("headerBold", DEFAULT_STYLE.headerBold),
    striped: bool("striped", DEFAULT_STYLE.striped),
    showGridlines: bool("showGridlines", DEFAULT_STYLE.showGridlines),
    headerFill: str("headerFill", DEFAULT_STYLE.headerFill),
  };
}

function normalize(a: Record<string, unknown>): SmartTableAttrs {
  const rows = Math.max(1, Number(a.rows) || DEFAULT_ROWS);
  const cols = Math.max(1, Number(a.cols) || DEFAULT_COLS);
  const headers: string[] = Array.isArray(a.headers) ? [...(a.headers as string[])] : [];
  while (headers.length < cols) headers.push("");
  headers.length = cols;
  const rawCells = Array.isArray(a.cells) ? (a.cells as string[][]) : [];
  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    const src = rawCells[r] ?? [];
    for (let c = 0; c < cols; c++) row.push(typeof src[c] === "string" ? src[c] : "");
    cells.push(row);
  }
  const colWidths = Array.isArray(a.colWidths) ? (a.colWidths as number[]) : undefined;
  return { rows, cols, headers, cells, colWidths, style: normalizeStyle(a.style) };
}

/** Source text a cell shows: `=` cells evaluate, everything else is verbatim. */
function cellSource(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("=")) {
    const r = evaluate(s.slice(1));
    return r.ok ? formatNumber(r.value) : "!err";
  }
  return raw;
}

/**
 * Render a cell through the SAME pipeline AI Edit previews with, so
 * `x_{i}` / `(x_i - μ)^{2}` appear as real mathematics inside tables.
 */
function cellDisplay(raw: string, keyBase: string): React.ReactNode {
  const src = cellSource(raw);
  if (!src) return null;
  return <>{renderMathInline(normalizeMathSource(src), keyBase)}</>;
}


export function SmartTable({ attrs, onChange, selected = false }: Props) {
  const model = useMemo(() => normalize(attrs), [attrs]);
  const { rows, cols, headers, cells, colWidths, style } = model;

  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [buffer, setBuffer] = useState<string>("");
  const [dimensionMode, setDimensionMode] = useState<"rows" | "cols">("rows");
  const [panelOpen, setPanelOpen] = useState(false);
  const [sumMenuOpen, setSumMenuOpen] = useState(false);
  const [sumMode, setSumMode] = useState<"row" | "col" | null>(null);
  /** Whole-line selection: a row or a column, highlighted end to end. */
  const [line, setLine] = useState<{ kind: "row" | "col"; index: number } | null>(null);
  /** Soft-selected cell: clicking the padding around a cell's text. Used as
   *  the anchor for inserting a FULL row / column inside the grid. */
  const [softCell, setSoftCell] = useState<{ r: number; c: number } | null>(null);

  useEffect(() => {
    if (!selected) { setPanelOpen(false); setSumMenuOpen(false); setSumMode(null); setLine(null); setSoftCell(null); }
  }, [selected]);

  useEffect(() => {
    if (!sumMode && !line && !softCell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSumMode(null);
      setLine(null);
      setSoftCell(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sumMode, line, softCell]);


  const patch = useCallback((next: Partial<SmartTableAttrs>) => {
    onChange({ ...next });
  }, [onChange]);

  const patchStyle = (p: Partial<SmartTableStyle>) => patch({ style: { ...style, ...p } });

  const instanceIdRef = useRef(`smartTable-${Math.random().toString(36).slice(2, 9)}`);

  // Latest model for callbacks that fire after the panel stole focus.
  const modelRef = useRef(model);
  modelRef.current = model;

  const aiBridge = useAiEditBridge();
  const [sel, setSel] = useState<{ s: number; e: number }>({ s: 0, e: 0 });
  /** Viewport point of the click that opened the cell, so the math caret can
   *  land exactly where the teacher clicked on the rendered value. */
  const [entryPoint, setEntryPoint] = useState<{ x: number; y: number } | null>(null);
  /** Live buffer for callbacks that fire after focus moved away. */
  const bufferRef = useRef("");
  bufferRef.current = buffer;

  const beginEdit = (r: number, c: number, point?: { x: number; y: number } | null) => {
    setActive({ r, c });
    setBuffer((r === -1 ? headers[c] : cells[r][c]) ?? "");
    setSel({ s: 0, e: 0 });
    setEntryPoint(point ?? null);
  };
  const cancelEdit = () => { setActive(null); setBuffer(""); setSel({ s: 0, e: 0 }); setEntryPoint(null); };
  const finishEdit = () => {
    if (!active) return;
    const { r, c } = active;
    const raw = (bufferRef.current ?? "").trim();
    if (r === -1) {
      const next = [...headers]; next[c] = raw; patch({ headers: next });
    } else {
      // Same calculation engine as before — the friendly form is what the
      // evaluator understands (√9, 3², 2+3), and anything symbolic falls
      // through untouched so it stays real mathematics.
      const solved = tryEvaluate(latexToFriendly(raw));
      const next = cells.map((row) => [...row]); next[r][c] = solved ?? raw; patch({ cells: next });
    }
    cancelEdit();
  };

  /** Write any cell (r === -1 addresses the header row) from latest state. */
  const writeAny = useCallback((r: number, c: number, value: string) => {
    const m = modelRef.current;
    if (r === -1) {
      const next = [...m.headers]; next[c] = value; patch({ headers: next });
    } else {
      const next = m.cells.map((row) => [...row]); next[r][c] = value; patch({ cells: next });
    }
  }, [patch]);

  // ── Cell-level toolbar (mirrors the document SelectionToolbar) ─────────
  const selRange = () => {
    const s = Math.max(0, Math.min(buffer.length, sel.s));
    const e = Math.max(0, Math.min(buffer.length, sel.e));
    return s === e ? { s: 0, e: buffer.length } : { s: Math.min(s, e), e: Math.max(s, e) };
  };
  const selectedText = () => { const { s, e } = selRange(); return buffer.slice(s, e); };
  const setBufferAndCell = (value: string) => {
    setBuffer(value);
    if (active) writeAny(active.r, active.c, value);
  };

  const cellCopy = async () => {
    try { await navigator.clipboard.writeText(selectedText()); toast({ title: "Copied" }); }
    catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };
  const cellCut = async () => {
    const { s, e } = selRange();
    try { await navigator.clipboard.writeText(buffer.slice(s, e)); } catch { /* noop */ }
    setBufferAndCell(buffer.slice(0, s) + buffer.slice(e));
    setSel({ s, e: s });
  };
  const cellDelete = () => {
    const { s, e } = selRange();
    setBufferAndCell(buffer.slice(0, s) + buffer.slice(e));
    setSel({ s, e: s });
  };
  const cellDuplicate = () => {
    const { s, e } = selRange();
    const piece = buffer.slice(s, e);
    setBufferAndCell(buffer.slice(0, e) + piece + buffer.slice(e));
  };
  const cellComment = () => toast({ title: "Comments coming soon" });

  const cellAiEdit = () => {
    if (!active) return;
    if (!aiBridge) { toast({ title: "AI Edit unavailable here", variant: "destructive" }); return; }
    const { r, c } = active;
    const { s, e } = selRange();
    const source = buffer;
    const text = source.slice(s, e).trim();
    if (!text) { toast({ title: "Nothing selected", variant: "destructive" }); return; }
    aiBridge.requestAiEdit({
      text,
      kind: detectSelectionKindFromText(text),
      label: [
        `Table cell (column "${(r === -1 ? headers[c] : headers[c]) || c + 1}"`,
        r === -1 ? "header row)" : `row ${r + 1})`,
        "— you may rewrite, shorten or delete these contents entirely; return only the cell's new value.",
      ].join(" "),
      onApply: (proposed) => {
        const merged = source.slice(0, s) + proposed + source.slice(e);
        writeAny(r, c, merged);
        setBuffer(merged);
      },
    });
  };


  const writeCell = (r: number, c: number, value: string) => {
    const next = cells.map((row) => [...row]);
    next[r][c] = value;
    patch({ cells: next });
  };

  /** Σ Sum Row — add every numeric cell to the LEFT of (r, c). */
  const sumRow = (r: number, c: number) => {
    let total = 0;
    for (let i = 0; i < c; i++) {
      const n = cellNumber(cells[r][i]);
      if (n !== null) total += n;
    }
    writeCell(r, c, formatNumber(total));
  };

  /** Σ Sum Column — add every numeric cell ABOVE (r, c). Headers excluded. */
  const sumCol = (r: number, c: number) => {
    let total = 0;
    for (let i = 0; i < r; i++) {
      const n = cellNumber(cells[i][c]);
      if (n !== null) total += n;
    }
    writeCell(r, c, formatNumber(total));
  };

  const handleCellClick = (r: number, c: number, e?: React.MouseEvent) => {
    if (sumMode) {
      if (sumMode === "row") sumRow(r, c); else sumCol(r, c);
      setSumMode(null);
      return;
    }
    // ONE CLICK = ACTIVE CELL. Anywhere inside the cell opens it for typing;
    // the click point is replayed so the caret lands where it was clicked.
    setLine(null);
    // The cell also stays the anchor for inserting a full row / column, but
    // that is tracked silently — no wash, no overlay.
    setSoftCell({ r, c });
    if (!isEditing(r, c)) beginEdit(r, c, e ? { x: e.clientX, y: e.clientY } : null);
  };

  // Structural edits always read the LIVE model (modelRef), never the
  // render-time closure: the Properties Panel button that triggers them can
  // outlive the render it was created in, and a stale snapshot would silently
  // revert other cells.
  const addRow = (at: number) => {
    const m = modelRef.current;
    const blank = Array.from({ length: m.cols }, () => "");
    const next = m.cells.map((row) => [...row]); next.splice(at, 0, blank);
    patch({ rows: m.rows + 1, cells: next });
  };
  const delRow = (at: number) => {
    const m = modelRef.current;
    if (m.rows <= 1) return;
    patch({ rows: m.rows - 1, cells: m.cells.filter((_, i) => i !== at).map((row) => [...row]) });
    if (active?.r === at) cancelEdit();
  };
  const addCol = (at: number) => {
    const m = modelRef.current;
    const nextHeaders = [...m.headers]; nextHeaders.splice(at, 0, "");
    const nextCells = m.cells.map((row) => { const rr = [...row]; rr.splice(at, 0, ""); return rr; });
    const nextW = m.colWidths ? [...m.colWidths] : undefined; if (nextW) nextW.splice(at, 0, 90);
    patch({ cols: m.cols + 1, headers: nextHeaders, cells: nextCells, colWidths: nextW });
  };
  const delCol = (at: number) => {
    const m = modelRef.current;
    if (m.cols <= 1) return;
    patch({
      cols: m.cols - 1,
      headers: m.headers.filter((_, i) => i !== at),
      cells: m.cells.map((row) => row.filter((_, i) => i !== at)),
      colWidths: m.colWidths ? m.colWidths.filter((_, i) => i !== at) : undefined,
    });
    if (active?.c === at) cancelEdit();
  };

  // ── Line (whole row / whole column) operations ────────────────────────
  // A "line" is a selected row or column. Inserting happens INSIDE the
  // grid at that index, and lines can be moved so rows/columns swap.

  const duplicateRow = (at: number) => {
    const m = modelRef.current;
    const next = m.cells.map((row) => [...row]);
    next.splice(at + 1, 0, [...(m.cells[at] ?? Array.from({ length: m.cols }, () => ""))]);
    patch({ rows: m.rows + 1, cells: next });
  };

  const duplicateCol = (at: number) => {
    const m = modelRef.current;
    const nextHeaders = [...m.headers]; nextHeaders.splice(at + 1, 0, m.headers[at] ?? "");
    const nextCells = m.cells.map((row) => {
      const rr = [...row]; rr.splice(at + 1, 0, row[at] ?? ""); return rr;
    });
    const nextW = m.colWidths ? [...m.colWidths] : undefined;
    if (nextW) nextW.splice(at + 1, 0, nextW[at] ?? 90);
    patch({ cols: m.cols + 1, headers: nextHeaders, cells: nextCells, colWidths: nextW });
  };

  const moveRow = (from: number, to: number) => {
    const m = modelRef.current;
    if (to < 0 || to >= m.rows || from === to) return;
    const next = m.cells.map((row) => [...row]);
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    patch({ cells: next });
    setLine({ kind: "row", index: to });
    cancelEdit();
  };

  const moveCol = (from: number, to: number) => {
    const m = modelRef.current;
    if (to < 0 || to >= m.cols || from === to) return;
    const nextHeaders = [...m.headers];
    const [h] = nextHeaders.splice(from, 1);
    nextHeaders.splice(to, 0, h);
    const nextCells = m.cells.map((row) => {
      const rr = [...row]; const [v] = rr.splice(from, 1); rr.splice(to, 0, v); return rr;
    });
    const nextW = m.colWidths ? [...m.colWidths] : undefined;
    if (nextW) { const [w] = nextW.splice(from, 1); nextW.splice(to, 0, w); }
    patch({ headers: nextHeaders, cells: nextCells, colWidths: nextW });
    setLine({ kind: "col", index: to });
    cancelEdit();
  };

  const isEditing = (r: number, c: number) => !!active && active.r === r && active.c === c;
  const colStyle = (c: number) => ({ width: colWidths?.[c] ?? undefined, minWidth: 72 });

  const borderCss = style.showGridlines
    ? `${style.borderWidth}px solid ${style.borderColor}`
    : "1px solid transparent";
  const tableStyle: React.CSSProperties = {
    opacity: style.opacity,
    filter: style.blur > 0 ? `blur(${style.blur}px)` : undefined,
    fontSize: `${style.textSize}px`,
    borderCollapse: "collapse",
    border: borderCss,
    color: "#0f172a", // dark ink by default — always visible on paper
  };
  const cellCss: React.CSSProperties = {
    border: borderCss,
    padding: `${style.cellPadY}px ${style.cellPadX}px`,
    textAlign: style.textAlign,
    verticalAlign: "middle",
    background: "transparent",
    color: "#0f172a",
  };
  const headerCss: React.CSSProperties = {
    ...cellCss,
    background: style.headerFill,
    fontWeight: style.headerBold ? 700 : 400,
  };

  // Anchor for in-place insertion: the highlighted cell, row or column.
  const anchorRow = softCell ? softCell.r : line?.kind === "row" ? line.index : null;
  const anchorCol = softCell ? softCell.c : line?.kind === "col" ? line.index : null;
  const anchorLabel = softCell
    ? `row ${softCell.r + 1}, column ${softCell.c + 1}`
    : line
      ? (line.kind === "row" ? `row ${line.index + 1}` : `column ${line.index + 1}`)
      : null;

  /** Insert a full empty row below the highlight and keep the highlight on it. */
  const addRowBelowAnchor = () => {
    const r = anchorRow ?? rows - 1;
    addRow(r + 1);
    if (softCell) setSoftCell({ r: r + 1, c: softCell.c });
    else setLine({ kind: "row", index: r + 1 });
  };
  /** Insert a full empty column to the right of the highlight, top to bottom. */
  const addColRightAnchor = () => {
    const c = anchorCol ?? cols - 1;
    addCol(c + 1);
    if (softCell) setSoftCell({ r: softCell.r, c: c + 1 });
    else setLine({ kind: "col", index: c + 1 });
  };

  const editor = (
    <div>
      <PanelGroup label={anchorLabel ? `Highlighted — ${anchorLabel}` : "Insert inside the table"}>
        {!anchorLabel && (
          <p className="px-1 py-1 text-[11px] text-foreground/60">
            Click a cell (or a row / column handle) to highlight it, then add a row or column inside the table here.
          </p>
        )}
        <PanelRow label="Add">
          <PanelButton onClick={addRowBelowAnchor}>Row below</PanelButton>
          <PanelButton onClick={addColRightAnchor}>Column right</PanelButton>
        </PanelRow>
      </PanelGroup>

      <PanelGroup label={line ? (line.kind === "row" ? `Selected row ${line.index + 1}` : `Selected column ${line.index + 1}`) : "Selected line"}>

        {!line && (
          <p className="px-1 py-1 text-[11px] text-foreground/60">
            Click a row or column handle on the table to select a whole line, then insert, move or delete it here.
          </p>
        )}
        {line?.kind === "row" && (
          <>
            <PanelRow label="Insert row">
              <PanelButton onClick={() => addRow(line.index)}>Above</PanelButton>
              <PanelButton onClick={() => addRow(line.index + 1)}>Below</PanelButton>
            </PanelRow>
            <PanelRow label="Move row">
              <PanelButton onClick={() => moveRow(line.index, line.index - 1)}>Up</PanelButton>
              <PanelButton onClick={() => moveRow(line.index, line.index + 1)}>Down</PanelButton>
            </PanelRow>
            <PanelRow label="Row">
              <PanelButton onClick={() => duplicateRow(line.index)}>Duplicate</PanelButton>
              <PanelButton onClick={() => { delRow(line.index); setLine(null); }}>Delete</PanelButton>
            </PanelRow>
          </>
        )}
        {line?.kind === "col" && (
          <>
            <PanelRow label="Insert column">
              <PanelButton onClick={() => addCol(line.index)}>Left</PanelButton>
              <PanelButton onClick={() => addCol(line.index + 1)}>Right</PanelButton>
            </PanelRow>
            <PanelRow label="Move column">
              <PanelButton onClick={() => moveCol(line.index, line.index - 1)}>Left</PanelButton>
              <PanelButton onClick={() => moveCol(line.index, line.index + 1)}>Right</PanelButton>
            </PanelRow>
            <PanelRow label="Column">
              <PanelButton onClick={() => duplicateCol(line.index)}>Duplicate</PanelButton>
              <PanelButton onClick={() => { delCol(line.index); setLine(null); }}>Delete</PanelButton>
            </PanelRow>
          </>
        )}
      </PanelGroup>

      {softCell && (
        <PanelGroup label={`Selected cell — row ${softCell.r + 1}, column ${softCell.c + 1}`}>
          <PanelRow label="Insert row">
            <PanelButton onClick={() => { addRow(softCell.r); setSoftCell({ r: softCell.r + 1, c: softCell.c }); }}>Above</PanelButton>
            <PanelButton onClick={() => addRow(softCell.r + 1)}>Below</PanelButton>
          </PanelRow>
          <PanelRow label="Insert column">
            <PanelButton onClick={() => { addCol(softCell.c); setSoftCell({ r: softCell.r, c: softCell.c + 1 }); }}>Left</PanelButton>
            <PanelButton onClick={() => addCol(softCell.c + 1)}>Right</PanelButton>
          </PanelRow>
          <PanelRow label="Move row">
            <PanelButton onClick={() => { moveRow(softCell.r, softCell.r - 1); setSoftCell({ r: Math.max(0, softCell.r - 1), c: softCell.c }); setLine(null); }}>Up</PanelButton>
            <PanelButton onClick={() => { moveRow(softCell.r, softCell.r + 1); setSoftCell({ r: Math.min(rows - 1, softCell.r + 1), c: softCell.c }); setLine(null); }}>Down</PanelButton>
          </PanelRow>
          <PanelRow label="Move column">
            <PanelButton onClick={() => { moveCol(softCell.c, softCell.c - 1); setSoftCell({ r: softCell.r, c: Math.max(0, softCell.c - 1) }); setLine(null); }}>Left</PanelButton>
            <PanelButton onClick={() => { moveCol(softCell.c, softCell.c + 1); setSoftCell({ r: softCell.r, c: Math.min(cols - 1, softCell.c + 1) }); setLine(null); }}>Right</PanelButton>
          </PanelRow>
          <PanelRow label="Delete">
            <PanelButton onClick={() => { delRow(softCell.r); setSoftCell(null); }}>Row</PanelButton>
            <PanelButton onClick={() => { delCol(softCell.c); setSoftCell(null); }}>Column</PanelButton>
          </PanelRow>
          <PanelRow label="Cell">
            <PanelButton onClick={() => { writeCell(softCell.r, softCell.c, ""); }}>Clear</PanelButton>
            <PanelButton onClick={() => { beginEdit(softCell.r, softCell.c); setSoftCell(null); }}>Edit text</PanelButton>
          </PanelRow>
        </PanelGroup>
      )}

      <PanelGroup label="Rows">
        <PanelRow label="Number of rows">
          <PanelButton onClick={() => delRow(rows - 1)}><Minus className="h-3 w-3" /></PanelButton>
          <span className="tabular-nums w-6 text-center">{rows}</span>
          <PanelButton onClick={() => addRow(rows)}><Plus className="h-3 w-3" /></PanelButton>
        </PanelRow>
      </PanelGroup>
      <PanelGroup label="Columns">
        <PanelRow label="Number of columns">
          <PanelButton onClick={() => delCol(cols - 1)}><Minus className="h-3 w-3" /></PanelButton>
          <span className="tabular-nums w-6 text-center">{cols}</span>
          <PanelButton onClick={() => addCol(cols)}><Plus className="h-3 w-3" /></PanelButton>
        </PanelRow>
      </PanelGroup>
      <PanelGroup label="Cell spacing">
        <PanelRow label="Padding X"><PanelNumber value={style.cellPadX} min={0} max={32} onChange={(v) => patchStyle({ cellPadX: v })} /></PanelRow>
        <PanelRow label="Padding Y"><PanelNumber value={style.cellPadY} min={0} max={32} onChange={(v) => patchStyle({ cellPadY: v })} /></PanelRow>
      </PanelGroup>
      <PanelGroup label="Appearance">
        <PanelRow label="Border thickness"><PanelNumber value={style.borderWidth} min={0} max={6} onChange={(v) => patchStyle({ borderWidth: v })} /></PanelRow>
        <PanelRow label="Border colour"><PanelColor value={style.borderColor} onChange={(v) => patchStyle({ borderColor: v })} /></PanelRow>
        <PanelRow label="Text size"><PanelNumber value={style.textSize} min={9} max={28} onChange={(v) => patchStyle({ textSize: v })} /></PanelRow>
        <PanelRow label="Opacity">
          <PanelNumber value={Math.round(style.opacity * 100)} min={10} max={100}
            onChange={(v) => patchStyle({ opacity: v / 100 })} />
        </PanelRow>
        <PanelRow label="Alignment">
          <select
            value={style.textAlign}
            onChange={(e) => patchStyle({ textAlign: e.target.value as SmartTableStyle["textAlign"] })}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </PanelRow>
        <PanelRow label="Bold headers"><PanelToggle value={style.headerBold} onChange={(v) => patchStyle({ headerBold: v })} /></PanelRow>
        <PanelRow label="Striped rows"><PanelToggle value={style.striped} onChange={(v) => patchStyle({ striped: v })} /></PanelRow>
        <PanelRow label="Show gridlines"><PanelToggle value={style.showGridlines} onChange={(v) => patchStyle({ showGridlines: v })} /></PanelRow>
      </PanelGroup>
      <PanelGroup>
        <PanelButton full onClick={() => patch({ style: DEFAULT_STYLE })}>Reset style</PanelButton>
      </PanelGroup>
    </div>
  );
  useRegisterAssetEditor(
    (!!selected && (panelOpen || line !== null || softCell !== null)) || active !== null,
    // Unique per table instance: a shared id let a second table's
    // registration hijack the first one's panel slot.
    instanceIdRef.current, "Smart table", editor,
  );

  const rowSelected = (r: number) => line?.kind === "row" && line.index === r;
  const colSelected = (c: number) => line?.kind === "col" && line.index === c;
  const cellSoft = (r: number, c: number) => !!softCell && softCell.r === r && softCell.c === c;
  /** NO CELL OVERLAY. Selection is communicated by the small edge handles only,
   *  so the grid stays a clean white mathematical surface. */
  const lineHi = (_r: number, _c: number): React.CSSProperties => ({});
  const handleCss: React.CSSProperties = {
    border: "1px solid rgba(37,99,235,0.35)",
    background: "rgba(37,99,235,0.08)",
    padding: 0,
    width: 16,
    minWidth: 16,
    height: 16,
    cursor: "pointer",
  };
  const selectLine = (kind: "row" | "col", index: number) => {
    cancelEdit();
    setSumMode(null);
    setSoftCell(null);
    setLine((p) => (p && p.kind === kind && p.index === index ? null : { kind, index }));
  };


  const adjustDown = () => {
    if (dimensionMode === "rows") delRow(rows - 1);
    else delCol(cols - 1);
  };

  const adjustUp = () => {
    if (dimensionMode === "rows") addRow(rows);
    else addCol(cols);
  };

  return (
    <div className="smart-table not-prose relative inline-block align-middle" onClick={(e) => e.stopPropagation()}>
      {sumMode && (
        <div
          contentEditable={false}
          className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
        >
          {sumMode === "row" ? "Sum Row" : "Sum Column"} — click the total cell (Esc to cancel)
        </div>
      )}
      <table style={tableStyle}>
        <thead>
          {selected && (
            <tr contentEditable={false}>
              <th style={{ ...handleCss, background: "transparent", border: "none" }} />
              {headers.map((_, c) => (
                <th
                  key={`ch${c}`}
                  title={`Select column ${c + 1}`}
                  aria-label={`Select column ${c + 1}`}
                  style={{
                    ...handleCss,
                    ...colStyle(c),
                    background: colSelected(c) ? "rgba(37,99,235,0.55)" : handleCss.background,
                  }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); selectLine("col", c); }}
                />
              ))}
            </tr>
          )}
          <tr>
            {selected && (
              <th style={{ ...handleCss, background: "transparent", border: "none" }} contentEditable={false} />
            )}
            {headers.map((h, c) => (
              <th
                key={c}
                style={{ ...headerCss, ...colStyle(c), ...lineHi(-1, c) }}
                className="relative"
                onClick={(e) => {
                  e.stopPropagation();
                  if (sumMode) return;
                  if (!isEditing(-1, c)) beginEdit(-1, c, { x: e.clientX, y: e.clientY });
                }}
              >
                {isEditing(-1, c) ? (
                  <>
                    <SmartTableCellToolbar
                      onCopy={cellCopy} onCut={cellCut} onDelete={cellDelete}
                      onDuplicate={cellDuplicate} onComment={cellComment} onAiEdit={cellAiEdit}
                    />
                    <MathCellEditor
                      value={buffer}
                      entryPoint={entryPoint}
                      onChange={setBuffer}
                      onCommit={finishEdit}
                    />
                  </>
                ) : (
                  <span className="block min-h-[1.4em]">
                    {h
                      ? cellDisplay(h, `h${c}`)
                      : selected
                        ? <span style={{ color: "#cbd5e1" }}>header</span>
                        : null}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, r) => (
            <tr key={r} style={style.striped && r % 2 === 1 ? { background: "rgba(15,23,42,0.04)" } : undefined}>
              {selected && (
                <td
                  contentEditable={false}
                  title={`Select row ${r + 1}`}
                  aria-label={`Select row ${r + 1}`}
                  style={{
                    ...handleCss,
                    background: rowSelected(r) ? "rgba(37,99,235,0.55)" : handleCss.background,
                  }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); selectLine("row", r); }}
                />
              )}
              {row.map((raw, c) => {
                const editing = isEditing(r, c);
                const rendered = cellDisplay(raw, `c${r}-${c}`);
                return (
                  <td
                    key={c}
                    style={{ ...cellCss, ...colStyle(c), ...lineHi(r, c) }}
                    className={
                      "relative " +
                      (sumMode ? "cursor-pointer hover:bg-primary/20" : "cursor-text hover:bg-black/5")
                    }
                    onClick={(e) => { e.stopPropagation(); handleCellClick(r, c, e); }}
                  >

                    {editing ? (
                      <>
                        <SmartTableCellToolbar
                          onCopy={cellCopy} onCut={cellCut} onDelete={cellDelete}
                          onDuplicate={cellDuplicate} onComment={cellComment} onAiEdit={cellAiEdit}
                        />
                        <MathCellEditor
                          value={buffer}
                          entryPoint={entryPoint}
                          onChange={setBuffer}
                          onCommit={finishEdit}
                        />
                      </>
                    ) : (
                      <span className="block min-h-[1.4em]">
                        <span data-cell-text className="inline-block">
                          {rendered}
                        </span>
                      </span>
                    )}
                  </td>
                );
              })}

            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <div
          className="mt-2 flex w-full items-center justify-center gap-1.5"
          contentEditable={false}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inline-flex overflow-hidden rounded-md border border-foreground/25 bg-background shadow-xs">
            <button
              type="button"
              aria-label="Edit rows"
              onClick={() => setDimensionMode("rows")}
              className={
                "h-7 px-2 text-[11px] font-medium transition-colors " +
                (dimensionMode === "rows" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-foreground/10")
              }
            >
              Row
            </button>
            <button
              type="button"
              aria-label="Edit columns"
              onClick={() => setDimensionMode("cols")}
              className={
                "h-7 border-l border-foreground/15 px-2 text-[11px] font-medium transition-colors " +
                (dimensionMode === "cols" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-foreground/10")
              }
            >
              Column
            </button>
          </div>
          <button
            type="button"
            aria-label={dimensionMode === "rows" ? "Remove row" : "Remove column"}
            onClick={adjustDown}
            disabled={dimensionMode === "rows" ? rows <= 1 : cols <= 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-foreground/25 bg-background text-foreground shadow-xs hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-6 text-center text-[11px] font-semibold tabular-nums text-foreground">
            {dimensionMode === "rows" ? rows : cols}
          </span>
          <button
            type="button"
            aria-label={dimensionMode === "rows" ? "Add row" : "Add column"}
            onClick={adjustUp}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-foreground/25 bg-background text-foreground shadow-xs hover:bg-foreground/10"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="Summation tools"
              onClick={() => {
                if (sumMode) { setSumMode(null); setSumMenuOpen(false); return; }
                setSumMenuOpen((v) => !v);
              }}
              className={
                "inline-flex h-7 w-7 items-center justify-center rounded-md border border-foreground/25 shadow-xs " +
                (sumMode || sumMenuOpen
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-foreground/10")
              }
            >
              <Sigma className="h-3.5 w-3.5" />
            </button>
            {sumMenuOpen && !sumMode && (
              <div className="absolute left-1/2 top-8 z-50 w-36 -translate-x-1/2 overflow-hidden rounded-md border border-foreground/20 bg-background shadow-lg">
                <button
                  type="button"
                  onClick={() => { setSumMode("row"); setSumMenuOpen(false); }}
                  className="block w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-foreground/10"
                >
                  Sum Row
                </button>
                <button
                  type="button"
                  onClick={() => { setSumMode("col"); setSumMenuOpen(false); }}
                  className="block w-full border-t border-foreground/10 px-2.5 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-foreground/10"
                >
                  Sum Column
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Open Smart table edit panel"
            onClick={() => setPanelOpen(true)}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-foreground px-2.5 text-[11px] font-semibold text-background shadow-xs hover:bg-foreground/90"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Cell editor = THE UNIVERSAL MATH EDITOR.
 *
 * Exactly the same `MathInlineCanvas` the lesson-note lines use, so every
 * mathematical tool available in the workspace is available inside a table
 * cell: `/` fractions, `#`/`##` powers and indices, smart brackets, roots and
 * infinite nesting, with the caret free to walk into every region.
 * Storage stays the shared LaTeX-lite string, so the display renderer
 * (`renderMathInline`) draws the committed cell identically.
 */
function MathCellEditor({ value, onChange, onCommit, entryPoint }: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  entryPoint?: { x: number; y: number } | null;
}) {
  const [root, setRoot] = useState<MathRow>(() => {
    try { return latexToTree(normalizeMathSource(value)); } catch { return [] as MathRow; }
  });

  const commit = (next: MathRow) => {
    setRoot(next);
    try { onChange(normalizeMathSource(treeToLatex(next))); } catch { /* keep last good value */ }
  };

  return (
    <span
      className="smart-table-cell-editor inline-block min-w-[3rem] px-1 py-0.5 align-baseline"
      style={{ color: "#0f172a" }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <MathInlineCanvas
        root={root}
        onChange={commit}
        onBlur={onCommit}
        focused
        onFocus={() => { /* already focused */ }}
        entryPoint={entryPoint ?? null}
        onExitLeft={onCommit}
        onExitRight={onCommit}
      />
    </span>
  );
}

export default SmartTable;
