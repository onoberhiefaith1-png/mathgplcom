// Division Ladder — one visible vertical divider (left of the numbers);
// every other alignment is done with invisible fixed-width columns so
// digits stay perfectly aligned. Editing is in the right-hand Properties
// Panel.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber,
} from "@/components/lessonnotes/panel/panelPrimitives";

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
}

function normalize(a: Record<string, unknown>) {
  const cols = Math.max(1, Number(a.cols) || 2);
  const divisors: string[] = Array.isArray(a.divisors) ? [...(a.divisors as string[])] : ["2", "2", "3"];
  const rowsNeeded = divisors.length + 1;
  const raw = Array.isArray(a.values) ? (a.values as string[][]) : [
    ["48", "60"], ["24", "30"], ["12", "15"], ["4", "5"],
  ];
  const values: string[][] = [];
  for (let r = 0; r < rowsNeeded; r++) {
    const src = raw[r] ?? [];
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(typeof src[c] === "string" ? src[c] : "");
    values.push(row);
  }
  return {
    divisors, values, cols,
    fontSize: Number(a.fontSize) || 18,
    rowHeight: Number(a.rowHeight) || 32,
    colWidth: Number(a.colWidth) || 56,
    dividerThickness: Number(a.dividerThickness) || 2,
  };
}

export function DivisionLadder({ attrs, onChange, selected }: Props) {
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

  const editor = (
    <div>
      <PanelGroup label="Rows">
        <PanelButton full onClick={addRow}><Plus className="h-3 w-3" /> Add row</PanelButton>
        <PanelButton full onClick={delRow}><Minus className="h-3 w-3" /> Delete row</PanelButton>
      </PanelGroup>
      <PanelGroup label="Number columns">
        <PanelButton full onClick={addCol}><Plus className="h-3 w-3" /> Add number column</PanelButton>
        <PanelButton full onClick={delCol}><Minus className="h-3 w-3" /> Remove number column</PanelButton>
      </PanelGroup>
      <PanelGroup label="Sizing">
        <PanelRow label="Font size"><PanelNumber value={m.fontSize} min={10} max={40} onChange={(v) => patch({ fontSize: v })} /></PanelRow>
        <PanelRow label="Row height"><PanelNumber value={m.rowHeight} min={20} max={80} onChange={(v) => patch({ rowHeight: v })} /></PanelRow>
        <PanelRow label="Column width"><PanelNumber value={m.colWidth} min={30} max={140} onChange={(v) => patch({ colWidth: v })} /></PanelRow>
        <PanelRow label="Divider thickness"><PanelNumber value={m.dividerThickness} min={1} max={6} onChange={(v) => patch({ dividerThickness: v })} /></PanelRow>
      </PanelGroup>
    </div>
  );
  useRegisterAssetEditor(!!selected, "divisionLadder", "Division ladder", editor);

  const cellBase: React.CSSProperties = {
    height: m.rowHeight,
    fontSize: m.fontSize,
    verticalAlign: "middle",
    padding: 0,
    width: m.colWidth,
    minWidth: m.colWidth,
    textAlign: "right",
  };

  return (
    <div className="not-prose inline-block font-mono text-foreground">
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {m.values.map((row, r) => {
            const isResult = r === m.values.length - 1;
            return (
              <tr key={r}>
                <td
                  style={{
                    ...cellBase,
                    width: 40, minWidth: 40,
                    paddingRight: 8,
                    borderRight: `${m.dividerThickness}px solid hsl(var(--foreground))`,
                  }}
                >
                  {isResult ? (
                    <span className="opacity-0 select-none">·</span>
                  ) : (
                    <SmartCell value={m.divisors[r] ?? ""} onChange={(v) => setDiv(r, v)} align="right" placeholder="d" />
                  )}
                </td>
                {row.map((v, c) => (
                  <td
                    key={c}
                    style={{
                      ...cellBase,
                      paddingLeft: 12,
                      fontWeight: isResult ? 700 : 500,
                      borderTop: isResult ? "1px solid hsl(var(--foreground) / 0.6)" : undefined,
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
    </div>
  );
}

export default DivisionLadder;
