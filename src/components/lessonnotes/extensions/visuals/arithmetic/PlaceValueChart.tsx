// Place-Value Chart — Units-locked, expandable to the LEFT. Starts as
// H | T | U with a single empty row. Columns can only be added or removed
// from the LEFT; Units cannot be removed. No visible vertical borders —
// invisible fixed-width cells keep every digit centred beneath its heading.
// Advanced properties live in the right-hand Properties Panel; row/column
// buttons live in an inline bottom toolbar under the asset.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { useHoverIdleVisibility } from "@/hooks/useHoverIdleVisibility";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelColor, PanelToggle,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { AssetBottomToolbar } from "@/components/lessonnotes/panel/AssetBottomToolbar";

interface Attrs {
  wholeHeaders?: string[];
  decimalHeaders?: string[];
  rows?: string[][];       // rows × wholeHeaders.length
  decRows?: string[][];    // rows × decimalHeaders.length
  fontSize?: number;
  headingSize?: number;
  colWidth?: number;
  rowHeight?: number;
  showGuides?: boolean;
  headingColor?: string;
  digitColor?: string;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
  /** Smart Structure board mode: static layer preserved, authoring chrome off. */
  board?: boolean;
}

// Left-expansion order. As the teacher presses Add Column, we pick the
// next name that isn't already present.
const LEFT_EXPANSION = ["T", "H", "Th", "TTh", "HTh", "M", "TM", "HM", "B"];

function normalize(a: Record<string, unknown>): Required<Attrs> {
  let wholeHeaders = Array.isArray(a.wholeHeaders) && a.wholeHeaders.length
    ? (a.wholeHeaders as string[]).slice()
    : ["H", "T", "U"];
  if (wholeHeaders[wholeHeaders.length - 1] !== "U") wholeHeaders.push("U");

  const decimalHeaders = Array.isArray(a.decimalHeaders) ? (a.decimalHeaders as string[]) : [];

  // Migrate legacy single-row shape (`values: string[]`) → `rows: string[][]`.
  let rows: string[][];
  if (Array.isArray(a.rows)) {
    rows = (a.rows as string[][]).map((r) => (Array.isArray(r) ? [...r] : []));
  } else if (Array.isArray((a as any).values)) {
    rows = [((a as any).values as string[]).slice()];
  } else {
    rows = [[]];
  }
  rows = rows.map((r) => {
    const out = [...r];
    while (out.length < wholeHeaders.length) out.push("");
    out.length = wholeHeaders.length;
    return out;
  });
  if (rows.length === 0) rows = [Array.from({ length: wholeHeaders.length }, () => "")];

  let decRows: string[][];
  if (Array.isArray(a.decRows)) {
    decRows = (a.decRows as string[][]).map((r) => (Array.isArray(r) ? [...r] : []));
  } else if (Array.isArray((a as any).decValues)) {
    decRows = [((a as any).decValues as string[]).slice()];
  } else {
    decRows = rows.map(() => []);
  }
  while (decRows.length < rows.length) decRows.push([]);
  decRows.length = rows.length;
  decRows = decRows.map((r) => {
    const out = [...r];
    while (out.length < decimalHeaders.length) out.push("");
    out.length = decimalHeaders.length;
    return out;
  });

  return {
    wholeHeaders,
    decimalHeaders,
    rows,
    decRows,
    fontSize: Number(a.fontSize) || 22,
    headingSize: Number(a.headingSize) || 13,
    colWidth: Number(a.colWidth) || 52,
    rowHeight: Number(a.rowHeight) || 44,
    showGuides: a.showGuides === undefined ? false : Boolean(a.showGuides),
    headingColor: typeof a.headingColor === "string" ? a.headingColor : "#0f172a",
    digitColor: typeof a.digitColor === "string" ? a.digitColor : "#0f172a",
  };
}

export function PlaceValueChart({ attrs, onChange, selected, board }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);

  const setCell = (r: number, c: number, v: string) => {
    const rows = m.rows.map((row) => [...row]); rows[r][c] = v; patch({ rows });
  };
  const setDecCell = (r: number, c: number, v: string) => {
    const decRows = m.decRows.map((row) => [...row]); decRows[r][c] = v; patch({ decRows });
  };

  // Add ONE column on the LEFT.
  const addLeft = () => {
    const used = new Set(m.wholeHeaders);
    const next = LEFT_EXPANSION.find((h) => !used.has(h)) ?? "?";
    patch({
      wholeHeaders: [next, ...m.wholeHeaders],
      rows: m.rows.map((r) => ["", ...r]),
    });
  };
  // Remove the LEFTMOST column, but never Units.
  const removeLeft = () => {
    if (m.wholeHeaders.length <= 1) return;
    patch({
      wholeHeaders: m.wholeHeaders.slice(1),
      rows: m.rows.map((r) => r.slice(1)),
    });
  };
  const addRow = () => patch({
    rows: [...m.rows, Array.from({ length: m.wholeHeaders.length }, () => "")],
    decRows: [...m.decRows, Array.from({ length: m.decimalHeaders.length }, () => "")],
  });
  const removeRow = () => {
    if (m.rows.length <= 1) return;
    patch({ rows: m.rows.slice(0, -1), decRows: m.decRows.slice(0, -1) });
  };
  const addDecCol = () => patch({
    decimalHeaders: [...m.decimalHeaders, ["t", "h", "th", "tth"][m.decimalHeaders.length] ?? ""],
    decRows: m.decRows.map((r) => [...r, ""]),
  });
  const removeDecCol = () => m.decimalHeaders.length > 0 && patch({
    decimalHeaders: m.decimalHeaders.slice(0, -1),
    decRows: m.decRows.map((r) => r.slice(0, -1)),
  });

  const cellStyle: React.CSSProperties = {
    width: m.colWidth,
    height: m.rowHeight,
    minWidth: m.colWidth,
    textAlign: "center",
    verticalAlign: "middle",
    padding: 0,
    borderLeft: m.showGuides ? "1px dashed hsl(var(--foreground) / 0.15)" : undefined,
  };
  const headStyle: React.CSSProperties = {
    ...cellStyle,
    fontSize: m.headingSize,
    color: m.headingColor,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderBottom: `3px solid ${m.headingColor}`,
  };
  const digitStyle: React.CSSProperties = {
    ...cellStyle,
    fontSize: m.fontSize,
    color: m.digitColor,
    fontWeight: 600,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  };

  const editor = useMemo(() => (
    <div>
      <PanelGroup label="Decimal columns">
        <PanelRow label="Count">
          <PanelButton onClick={removeDecCol}><Minus className="h-3 w-3" /></PanelButton>
          <span className="tabular-nums w-4 text-center">{m.decimalHeaders.length}</span>
          <PanelButton onClick={addDecCol}><Plus className="h-3 w-3" /></PanelButton>
        </PanelRow>
      </PanelGroup>

      <PanelGroup label="Sizing">
        <PanelRow label="Font size"><PanelNumber value={m.fontSize} min={10} max={48} onChange={(v) => patch({ fontSize: v })} /></PanelRow>
        <PanelRow label="Heading size"><PanelNumber value={m.headingSize} min={8} max={24} onChange={(v) => patch({ headingSize: v })} /></PanelRow>
        <PanelRow label="Column width"><PanelNumber value={m.colWidth} min={24} max={120} onChange={(v) => patch({ colWidth: v })} /></PanelRow>
        <PanelRow label="Row height"><PanelNumber value={m.rowHeight} min={24} max={96} onChange={(v) => patch({ rowHeight: v })} /></PanelRow>
      </PanelGroup>

      <PanelGroup label="Appearance">
        <PanelRow label="Show alignment guides"><PanelToggle value={m.showGuides} onChange={(v) => patch({ showGuides: v })} /></PanelRow>
        <PanelRow label="Heading colour"><PanelColor value={m.headingColor} onChange={(v) => patch({ headingColor: v })} /></PanelRow>
        <PanelRow label="Digit colour"><PanelColor value={m.digitColor} onChange={(v) => patch({ digitColor: v })} /></PanelRow>
      </PanelGroup>
    </div>
  ), [m.decimalHeaders.length, m.fontSize, m.headingSize, m.colWidth, m.rowHeight, m.showGuides, m.headingColor, m.digitColor, patch, addDecCol, removeDecCol]);
  useRegisterAssetEditor(!!selected && !board, "placeValueChart", "Place-value chart", editor);

  const { visible: toolbarVisible, bind } = useHoverIdleVisibility({ idleMs: 10000, forceVisible: !!selected });

  return (
    <div
      className="not-prose inline-block"
      onPointerEnter={bind.onPointerEnter}
      onPointerMove={bind.onPointerMove}
      onPointerLeave={bind.onPointerLeave}
      onPointerDown={bind.onPointerDown}
      onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {m.wholeHeaders.map((h, i) => (
              <th key={"wh" + i} style={headStyle}>{h}</th>
            ))}
            {m.decimalHeaders.length > 0 && (
              <th style={{ ...headStyle, width: 14, minWidth: 14, borderBottom: "none" }}> </th>
            )}
            {m.decimalHeaders.map((h, i) => (
              <th key={"dh" + i} style={headStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.rows.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => (
                <td key={"wv" + r + "-" + c} style={digitStyle}>
                  <SmartCell value={v} onChange={(nv) => setCell(r, c, nv)} align="center" />
                </td>
              ))}
              {m.decimalHeaders.length > 0 && (
                <td style={{ ...digitStyle, width: 14, minWidth: 14, fontWeight: 900 }}>·</td>
              )}
              {(m.decRows[r] ?? []).map((v, c) => (
                <td key={"dv" + r + "-" + c} style={digitStyle}>
                  <SmartCell value={v} onChange={(nv) => setDecCell(r, c, nv)} align="center" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <AssetBottomToolbar
        visible={toolbarVisible && !board}
        bind={bind}
        actions={[
          { label: "Column", icon: <Plus className="h-3 w-3" />, onClick: addLeft },
          { label: "Column", icon: <Minus className="h-3 w-3" />, onClick: removeLeft, disabled: m.wholeHeaders.length <= 1, tone: "danger" },
          { label: "Row", icon: <Plus className="h-3 w-3" />, onClick: addRow },
          { label: "Row", icon: <Minus className="h-3 w-3" />, onClick: removeRow, disabled: m.rows.length <= 1, tone: "danger" },
        ]}
      />
    </div>
  );
}

export default PlaceValueChart;
