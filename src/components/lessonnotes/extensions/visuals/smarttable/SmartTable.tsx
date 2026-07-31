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
import { detectSelectionKindFromText } from "@/lib/lessonnotes/detectSelectionKind";
import { toast } from "@/hooks/use-toast";
import { SmartTableCellToolbar } from "./SmartTableCellToolbar";
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

  useEffect(() => {
    if (!selected) { setPanelOpen(false); setSumMenuOpen(false); setSumMode(null); }
  }, [selected]);

  useEffect(() => {
    if (!sumMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSumMode(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sumMode]);

  const patch = useCallback((next: Partial<SmartTableAttrs>) => {
    onChange({ ...next });
  }, [onChange]);

  const patchStyle = (p: Partial<SmartTableStyle>) => patch({ style: { ...style, ...p } });

  // Latest model for callbacks that fire after the panel stole focus.
  const modelRef = useRef(model);
  modelRef.current = model;

  const aiBridge = useAiEditBridge();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sel, setSel] = useState<{ s: number; e: number }>({ s: 0, e: 0 });

  const beginEdit = (r: number, c: number) => {
    setActive({ r, c });
    setBuffer((r === -1 ? headers[c] : cells[r][c]) ?? "");
    setSel({ s: 0, e: 0 });
  };
  const cancelEdit = () => { setActive(null); setBuffer(""); setSel({ s: 0, e: 0 }); };
  const finishEdit = () => {
    if (!active) return;
    const { r, c } = active;
    if (r === -1) {
      const next = [...headers]; next[c] = buffer.trim(); patch({ headers: next });
    } else {
      const raw = buffer.trim();
      const solved = tryEvaluate(raw);
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
      label: "Table cell",
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

  const handleCellClick = (r: number, c: number) => {
    if (sumMode) {
      if (sumMode === "row") sumRow(r, c); else sumCol(r, c);
      setSumMode(null);
      return;
    }
    if (!isEditing(r, c)) beginEdit(r, c);
  };

  const addRow = (at: number) => {
    const blank = Array.from({ length: cols }, () => "");
    const next = [...cells]; next.splice(at, 0, blank);
    patch({ rows: rows + 1, cells: next });
  };
  const delRow = (at: number) => {
    if (rows <= 1) return;
    patch({ rows: rows - 1, cells: cells.filter((_, i) => i !== at) });
    if (active?.r === at) cancelEdit();
  };
  const addCol = (at: number) => {
    const nextHeaders = [...headers]; nextHeaders.splice(at, 0, "");
    const nextCells = cells.map((row) => { const rr = [...row]; rr.splice(at, 0, ""); return rr; });
    const nextW = colWidths ? [...colWidths] : undefined; if (nextW) nextW.splice(at, 0, 90);
    patch({ cols: cols + 1, headers: nextHeaders, cells: nextCells, colWidths: nextW });
  };
  const delCol = (at: number) => {
    if (cols <= 1) return;
    patch({
      cols: cols - 1,
      headers: headers.filter((_, i) => i !== at),
      cells: cells.map((row) => row.filter((_, i) => i !== at)),
      colWidths: colWidths ? colWidths.filter((_, i) => i !== at) : undefined,
    });
    if (active?.c === at) cancelEdit();
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

  const editor = (
    <div>
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
  useRegisterAssetEditor((!!selected && panelOpen) || active !== null, "smartTable", "Smart table", editor);

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
          <tr>
            {headers.map((h, c) => (
              <th
                key={c}
                style={{ ...headerCss, ...colStyle(c) }}
                className="relative"
                onClick={(e) => { e.stopPropagation(); if (sumMode) return; if (!isEditing(-1, c)) beginEdit(-1, c); }}
              >
                {isEditing(-1, c) ? (
                  <>
                    <SmartTableCellToolbar
                      onCopy={cellCopy} onCut={cellCut} onDelete={cellDelete}
                      onDuplicate={cellDuplicate} onComment={cellComment} onAiEdit={cellAiEdit}
                    />
                    <InlineEditor
                      inputRef={inputRef} value={buffer} onChange={setBuffer}
                      onSelect={(s, e) => setSel({ s, e })}
                      onCommit={finishEdit} onCancel={cancelEdit}
                    />
                  </>
                ) : (
                  <span className="block min-h-[1.4em]">
                    {h
                      ? cellDisplay(h, `h${c}`)
                      : <span style={{ color: "#94a3b8" }}>header</span>}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, r) => (
            <tr key={r} style={style.striped && r % 2 === 1 ? { background: "rgba(15,23,42,0.04)" } : undefined}>
              {row.map((raw, c) => {
                const editing = isEditing(r, c);
                const rendered = cellDisplay(raw, `c${r}-${c}`);
                return (
                  <td
                    key={c}
                    style={{ ...cellCss, ...colStyle(c) }}
                    className={
                      "relative " +
                      (sumMode ? "cursor-pointer hover:bg-primary/20" : "cursor-text hover:bg-black/5")
                    }
                    onClick={(e) => { e.stopPropagation(); handleCellClick(r, c); }}
                  >
                    {editing ? (
                      <>
                        <SmartTableCellToolbar
                          onCopy={cellCopy} onCut={cellCut} onDelete={cellDelete}
                          onDuplicate={cellDuplicate} onComment={cellComment} onAiEdit={cellAiEdit}
                        />
                        <InlineEditor
                          inputRef={inputRef} value={buffer} onChange={setBuffer}
                          onSelect={(s, e) => setSel({ s, e })}
                          onCommit={finishEdit} onCancel={cancelEdit}
                        />
                      </>
                    ) : (
                      <span className="block min-h-[1.4em]">
                        {rendered ?? <span style={{ color: "#cbd5e1" }}>·</span>}
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

function InlineEditor({ value, onChange, onCommit, onCancel, onSelect, inputRef }: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onSelect?: (start: number, end: number) => void;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
}) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const attach = (el: HTMLInputElement | null) => {
    localRef.current = el;
    if (inputRef) inputRef.current = el;
  };
  useEffect(() => {
    localRef.current?.focus();
    localRef.current?.select();
    onSelect?.(0, localRef.current?.value.length ?? 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const report = () => {
    const el = localRef.current;
    if (!el) return;
    onSelect?.(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  };

  return (
    <input
      ref={attach}
      value={value}
      onChange={(e) => { onChange(e.target.value); report(); }}
      onSelect={report}
      onKeyUp={report}
      onMouseUp={report}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onCommit(); }
        else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      onClick={(e) => { e.stopPropagation(); report(); }}
      className="w-full min-w-[3rem] px-1 py-0.5 text-center bg-transparent outline-hidden border-b border-primary"
      style={{ color: "#0f172a" }}
    />
  );

}

export default SmartTable;
