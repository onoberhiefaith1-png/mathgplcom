// Division Ladder — one visible vertical divider on the left, everything
// else invisible. Opens empty: one divisor row + one result row, one
// number column, no seeded values. Advanced settings live in the right-hand
// Properties Panel; add/remove rows and columns in the bottom toolbar.

import { useCallback, useMemo, useState } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { useHoverIdleVisibility } from "@/hooks/useHoverIdleVisibility";
import {
  PanelGroup, PanelRow, PanelNumber,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { AssetBottomToolbar } from "@/components/lessonnotes/panel/AssetBottomToolbar";

interface Attrs {
  divisors?: string[];
  values?: string[][];
  cols?: number;
  fontSize?: number;
  rowHeight?: number;
  colWidth?: number;
  dividerThickness?: number;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
  /** Smart Structure board mode: static layer preserved, authoring chrome off. */
  board?: boolean;
}

function normalize(a: Record<string, unknown>) {
  const cols = Math.max(1, Number(a.cols) || 1);
  const divisors: string[] = Array.isArray(a.divisors) && (a.divisors as string[]).length
    ? [...(a.divisors as string[])]
    : [""];
  const rowsNeeded = divisors.length + 1;
  const raw = Array.isArray(a.values) ? (a.values as string[][]) : [];
  const values: string[][] = [];
  for (let r = 0; r < rowsNeeded; r++) {
    const src = raw[r] ?? [];
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(typeof src[c] === "string" ? src[c] : "");
    values.push(row);
  }
  return {
    divisors, values, cols,
    fontSize: Number(a.fontSize) || 22,
    rowHeight: Number(a.rowHeight) || 40,
    colWidth: Number(a.colWidth) || 64,
    dividerThickness: Number(a.dividerThickness) || 3,
  };
}

export function DivisionLadder({ attrs, onChange, selected, board }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);

  const setDiv = (i: number, v: string) => {
    const d = [...m.divisors]; d[i] = v; patch({ divisors: d });
  };
  const setCell = (r: number, c: number, v: string) => {
    const next = m.values.map((row) => [...row]); next[r][c] = v; patch({ values: next });
  };
  const addRow = () => {
    const nd = [...m.divisors, ""];
    const nv = [...m.values];
    nv.splice(nv.length - 1, 0, Array.from({ length: m.cols }, () => ""));
    patch({ divisors: nd, values: nv });
  };
  const delRow = () => {
    if (m.divisors.length <= 1) return;
    const nd = m.divisors.slice(0, -1);
    const nv = [...m.values]; nv.splice(nv.length - 2, 1);
    patch({ divisors: nd, values: nv });
  };
  const addCol = () => patch({
    cols: m.cols + 1,
    values: m.values.map((row) => [...row, ""]),
  });
  const delCol = () => m.cols > 1 && patch({
    cols: m.cols - 1,
    values: m.values.map((row) => row.slice(0, -1)),
  });

  const editor = useMemo(() => (
    <div>
      <PanelGroup label="Sizing">
        <PanelRow label="Font size"><PanelNumber value={m.fontSize} min={10} max={40} onChange={(v) => patch({ fontSize: v })} /></PanelRow>
        <PanelRow label="Row height"><PanelNumber value={m.rowHeight} min={20} max={80} onChange={(v) => patch({ rowHeight: v })} /></PanelRow>
        <PanelRow label="Column width"><PanelNumber value={m.colWidth} min={30} max={140} onChange={(v) => patch({ colWidth: v })} /></PanelRow>
        <PanelRow label="Divider thickness"><PanelNumber value={m.dividerThickness} min={1} max={6} onChange={(v) => patch({ dividerThickness: v })} /></PanelRow>
      </PanelGroup>
    </div>
  ), [m.fontSize, m.rowHeight, m.colWidth, m.dividerThickness, patch]);
  useRegisterAssetEditor(!!selected && !board, "divisionLadder", "Division ladder", editor);

  const { visible: toolbarVisible, bind } = useHoverIdleVisibility({ idleMs: 10000, forceVisible: !!selected });
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  const cellBase: React.CSSProperties = {
    height: m.rowHeight,
    fontSize: m.fontSize,
    verticalAlign: "middle",
    padding: 0,
    width: m.colWidth,
    minWidth: m.colWidth,
    textAlign: "right",
    color: "#0f172a",
    fontWeight: 500,
    boxSizing: "border-box",
  };

  const hoverStyle = (r: number, c: number): React.CSSProperties =>
    hover && hover.r === r && hover.c === c
      ? {
          borderLeft: "1px dashed rgba(15,23,42,0.35)",
          borderRight: "1px dashed rgba(15,23,42,0.35)",
          background: "rgba(15,23,42,0.04)",
        }
      : {};

  return (
    <div
      className="not-prose inline-block font-mono"
      style={{ color: "#0f172a" }}
      onPointerEnter={bind.onPointerEnter}
      onPointerMove={bind.onPointerMove}
      onPointerLeave={bind.onPointerLeave}
      onPointerDown={bind.onPointerDown}
      onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <table style={{ borderCollapse: "collapse" }} onPointerLeave={() => setHover(null)}>
        <tbody>
          {m.values.map((row, r) => {
            const isResult = r === m.values.length - 1;
            const divHover = hover && hover.r === r && hover.c === -1;
            return (
              <tr key={r}>
                <td
                  onPointerEnter={() => setHover({ r, c: -1 })}
                  style={{
                    ...cellBase,
                    width: 48, minWidth: 48,
                    paddingRight: 10,
                    borderRight: `${m.dividerThickness}px solid #0f172a`,
                    borderLeft: divHover ? "1px dashed rgba(15,23,42,0.35)" : undefined,
                    background: divHover ? "rgba(15,23,42,0.04)" : undefined,
                  }}
                >
                  {isResult ? (
                    <span className="opacity-0 select-none">·</span>
                  ) : (
                    <SmartCell value={m.divisors[r] ?? ""} onChange={(v) => setDiv(r, v)} align="right" placeholder="" />
                  )}
                </td>
                {row.map((v, c) => (
                  <td
                    key={c}
                    onPointerEnter={() => setHover({ r, c })}
                    style={{
                      ...cellBase,
                      paddingLeft: 14,
                      fontWeight: 600,
                      ...hoverStyle(r, c),
                    }}
                  >
                    <SmartCell value={v} onChange={(nv) => setCell(r, c, nv)} align="right" />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>


      <AssetBottomToolbar
        visible={toolbarVisible && !board}
        bind={bind}
        actions={[
          { label: "Row", icon: <Plus className="h-3 w-3" />, onClick: addRow },
          { label: "Row", icon: <Minus className="h-3 w-3" />, onClick: delRow, disabled: m.divisors.length <= 1, tone: "danger" },
          { label: "Column", icon: <Plus className="h-3 w-3" />, onClick: addCol },
          { label: "Column", icon: <Minus className="h-3 w-3" />, onClick: delCol, disabled: m.cols <= 1, tone: "danger" },
        ]}
      />
    </div>
  );
}

export default DivisionLadder;
