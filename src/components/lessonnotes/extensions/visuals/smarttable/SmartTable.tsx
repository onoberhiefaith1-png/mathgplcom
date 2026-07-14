// Smart Table — a single editable data grid that becomes any statistical
// table. Table style (padding, border, color, opacity, blur, text) is
// controlled from a settings popover so teachers can dial the look on the
// fly and bring the table forward when they want it visible.

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Plus, Minus } from "lucide-react";
import { evaluate, formatNumber } from "./evaluator";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelColor, PanelToggle,
} from "@/components/lessonnotes/panel/panelPrimitives";

export interface SmartTableStyle {
  cellPadX: number;      // px
  cellPadY: number;      // px
  borderWidth: number;   // px
  borderColor: string;   // css color
  opacity: number;       // 0..1
  blur: number;          // px
  textSize: number;      // px
  textAlign: "left" | "center" | "right";
  headerBold: boolean;
  striped: boolean;
  showGridlines: boolean;
  headerFill: string;    // css color, "transparent" allowed
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

const DEFAULT_STYLE: SmartTableStyle = {
  cellPadX: 8,
  cellPadY: 6,
  borderWidth: 1,
  borderColor: "#e0b060",
  opacity: 0.85,
  blur: 0,
  textSize: 13,
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

function cellDisplay(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("=")) {
    const r = evaluate(s.slice(1));
    return r.ok ? formatNumber(r.value) : "!err";
  }
  return raw;
}

export function SmartTable({ attrs, onChange, selected = false }: Props) {
  const model = useMemo(() => normalize(attrs), [attrs]);
  const { rows, cols, headers, cells, colWidths, style } = model;

  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [buffer, setBuffer] = useState<string>("");

  const patch = useCallback((next: Partial<SmartTableAttrs>) => {
    onChange({ ...next });
  }, [onChange]);

  const patchStyle = (p: Partial<SmartTableStyle>) => patch({ style: { ...style, ...p } });

  const beginEdit = (r: number, c: number) => {
    setActive({ r, c });
    setBuffer((r === -1 ? headers[c] : cells[r][c]) ?? "");
  };
  const cancelEdit = () => { setActive(null); setBuffer(""); };
  const finishEdit = () => {
    if (!active) return;
    const { r, c } = active;
    if (r === -1) {
      const next = [...headers]; next[c] = buffer.trim(); patch({ headers: next });
    } else {
      const next = cells.map((row) => [...row]); next[r][c] = buffer.trim(); patch({ cells: next });
    }
    cancelEdit();
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
  };
  const cellCss: React.CSSProperties = {
    border: borderCss,
    padding: `${style.cellPadY}px ${style.cellPadX}px`,
    textAlign: style.textAlign,
    verticalAlign: "middle",
    background: "transparent",
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
        <PanelRow label="Text size"><PanelNumber value={style.textSize} min={9} max={24} onChange={(v) => patchStyle({ textSize: v })} /></PanelRow>
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
  useRegisterAssetEditor(!!selected || active !== null, "smartTable", "Smart table", editor);

  return (
    <div className="smart-table not-prose relative inline-block align-middle text-foreground">


      <table style={tableStyle}>
        <thead>
          <tr>
            {headers.map((h, c) => (
              <th
                key={c}
                style={{ ...headerCss, ...colStyle(c) }}
                className="relative"
                onClick={(e) => { e.stopPropagation(); if (!isEditing(-1, c)) beginEdit(-1, c); }}
              >
                {isEditing(-1, c) ? (
                  <InlineEditor value={buffer} onChange={setBuffer} onCommit={finishEdit} onCancel={cancelEdit} />
                ) : (
                  <span className="block min-h-[1.4em]">
                    {h || <span className="text-foreground/30">header</span>}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, r) => (
            <tr key={r} style={style.striped && r % 2 === 1 ? { background: "rgba(255,255,255,0.03)" } : undefined}>
              {row.map((raw, c) => {
                const editing = isEditing(r, c);
                return (
                  <td
                    key={c}
                    style={{ ...cellCss, ...colStyle(c) }}
                    className="cursor-text hover:bg-foreground/5"
                    onClick={(e) => { e.stopPropagation(); if (!editing) beginEdit(r, c); }}
                  >
                    {editing ? (
                      <InlineEditor value={buffer} onChange={setBuffer} onCommit={finishEdit} onCancel={cancelEdit} />
                    ) : (
                      <span className="block min-h-[1.4em]">
                        {cellDisplay(raw) || <span className="text-foreground/20">·</span>}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {settingsOpen && (
        <div
          ref={settingsRef}
          className="absolute z-30 top-0 right-0 mt-6 w-64 rounded-lg border border-foreground/20 bg-background/95 backdrop-blur shadow-xl p-3 text-[12px] space-y-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] uppercase tracking-widest text-foreground/50">Table settings</div>
          <Range label="Cell padding X" value={style.cellPadX} min={0} max={32} onChange={(v) => patchStyle({ cellPadX: v })} />
          <Range label="Cell padding Y" value={style.cellPadY} min={0} max={32} onChange={(v) => patchStyle({ cellPadY: v })} />
          <Range label="Border thickness" value={style.borderWidth} min={0} max={6} onChange={(v) => patchStyle({ borderWidth: v })} />
          <Range label="Opacity" value={Math.round(style.opacity * 100)} min={10} max={100} onChange={(v) => patchStyle({ opacity: v / 100 })} suffix="%" />
          <Range label="Blur" value={style.blur} min={0} max={6} onChange={(v) => patchStyle({ blur: v })} suffix="px" />
          <Range label="Text size" value={style.textSize} min={9} max={24} onChange={(v) => patchStyle({ textSize: v })} suffix="px" />
          <ColorRow label="Line color" value={style.borderColor} onChange={(v) => patchStyle({ borderColor: v })} />
          <ColorRow label="Header fill" value={style.headerFill === "transparent" ? "#000000" : style.headerFill} onChange={(v) => patchStyle({ headerFill: v })} extra={
            <button className="text-[10px] underline text-foreground/60" onClick={() => patchStyle({ headerFill: "transparent" })}>none</button>
          } />
          <div className="flex items-center gap-2">
            <label className="text-foreground/70 w-24">Align</label>
            <select
              value={style.textAlign}
              onChange={(e) => patchStyle({ textAlign: e.target.value as SmartTableStyle["textAlign"] })}
              className="flex-1 bg-background border border-foreground/20 rounded px-1 py-0.5"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <Toggle label="Bold headers" value={style.headerBold} onChange={(v) => patchStyle({ headerBold: v })} />
          <Toggle label="Striped rows" value={style.striped} onChange={(v) => patchStyle({ striped: v })} />
          <Toggle label="Show gridlines" value={style.showGridlines} onChange={(v) => patchStyle({ showGridlines: v })} />
          <div className="pt-1 flex justify-between">
            <button className="text-[11px] underline text-foreground/60" onClick={() => patch({ style: DEFAULT_STYLE })}>Reset</button>
            <button className="text-[11px] underline text-foreground/60" onClick={() => setSettingsOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Range({ label, value, min, max, onChange, suffix }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-foreground/70 w-24">{label}</label>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="w-10 text-right tabular-nums text-foreground/60">{value}{suffix ?? ""}</span>
    </div>
  );
}

function ColorRow({ label, value, onChange, extra }: {
  label: string; value: string; onChange: (v: string) => void; extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-foreground/70 w-24">{label}</label>
      <input
        type="color" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 rounded border border-foreground/20 bg-transparent cursor-pointer"
      />
      <input
        type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-background border border-foreground/20 rounded px-1 py-0.5 font-mono text-[11px]"
      />
      {extra}
    </div>
  );
}

function Toggle({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-foreground/80">{label}</span>
    </label>
  );
}

function GutterBtn({ children, onClick, title, danger }: {
  children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className={
        "h-4 w-4 grid place-items-center rounded text-[10px] " +
        (danger
          ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
          : "bg-primary/20 text-primary hover:bg-primary/30")
      }
    >{children}</button>
  );
}

function InlineEditor({ value, onChange, onCommit, onCancel }: {
  value: string; onChange: (v: string) => void; onCommit: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onCommit(); }
        else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-full min-w-[3rem] px-1 py-0.5 text-center bg-transparent outline-none border-b border-primary"
    />
  );
}

export default SmartTable;
