// Number-Base Conversion — repeated-division layout with a single visible
// vertical divider that auto-extends as rows are added. Remainders are
// shown in an invisible right-aligned "R" column (no arrows).
// Editing lives in the right-hand Properties Panel.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber,
} from "@/components/lessonnotes/panel/panelPrimitives";

interface Attrs {
  base?: string;
  rows?: Array<{ q: string; r: string }>;
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

function normalize(a: Record<string, unknown>): Required<Attrs> {
  return {
    base: typeof a.base === "string" ? a.base : "2",
    rows: Array.isArray(a.rows) ? (a.rows as Array<{ q: string; r: string }>) : [
      { q: "45", r: "" },
      { q: "22", r: "1" },
      { q: "11", r: "0" },
      { q: "5",  r: "1" },
      { q: "2",  r: "1" },
      { q: "1",  r: "0" },
      { q: "0",  r: "1" },
    ],
    fontSize: Number(a.fontSize) || 18,
    rowHeight: Number(a.rowHeight) || 34,
    colWidth: Number(a.colWidth) || 60,
    dividerThickness: Number(a.dividerThickness) || 2,
  };
}

export function BaseConversion({ attrs, onChange, selected }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);

  const setQ = (i: number, v: string) => {
    const rows = m.rows.map((r) => ({ ...r })); rows[i].q = v; patch({ rows });
  };
  const setR = (i: number, v: string) => {
    const rows = m.rows.map((r) => ({ ...r })); rows[i].r = v; patch({ rows });
  };
  const addRow = () => patch({ rows: [...m.rows, { q: "", r: "" }] });
  const delRow = () => m.rows.length > 1 && patch({ rows: m.rows.slice(0, -1) });

  const editor = (
    <div>
      <PanelGroup label="Rows">
        <PanelButton full onClick={addRow}><Plus className="h-3 w-3" /> Add row</PanelButton>
        <PanelButton full onClick={delRow}><Minus className="h-3 w-3" /> Delete last row</PanelButton>
      </PanelGroup>
      <PanelGroup label="Sizing">
        <PanelRow label="Font size"><PanelNumber value={m.fontSize} min={10} max={40} onChange={(v) => patch({ fontSize: v })} /></PanelRow>
        <PanelRow label="Row height"><PanelNumber value={m.rowHeight} min={20} max={80} onChange={(v) => patch({ rowHeight: v })} /></PanelRow>
        <PanelRow label="Column width"><PanelNumber value={m.colWidth} min={30} max={140} onChange={(v) => patch({ colWidth: v })} /></PanelRow>
        <PanelRow label="Divider thickness"><PanelNumber value={m.dividerThickness} min={1} max={6} onChange={(v) => patch({ dividerThickness: v })} /></PanelRow>
      </PanelGroup>
    </div>
  );
  useRegisterAssetEditor(!!selected, "baseConversion", "Base conversion", editor);

  const cellBase: React.CSSProperties = {
    height: m.rowHeight,
    fontSize: m.fontSize,
    verticalAlign: "middle",
    padding: 0,
  };

  return (
    <div className="not-prose inline-block font-mono text-foreground">
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {m.rows.map((row, i) => (
            <tr key={i}>
              <td
                style={{
                  ...cellBase,
                  width: 36, minWidth: 36,
                  textAlign: "right",
                  paddingRight: 8,
                  borderRight: `${m.dividerThickness}px solid hsl(var(--foreground))`,
                }}
              >
                <SmartCell value={m.base} onChange={(v) => patch({ base: v })} align="right" placeholder="b" />
              </td>
              <td
                style={{
                  ...cellBase,
                  width: m.colWidth, minWidth: m.colWidth,
                  textAlign: "right",
                  paddingLeft: 12, paddingRight: 12,
                }}
              >
                <SmartCell value={row.q} onChange={(v) => setQ(i, v)} align="right" placeholder="q" />
              </td>
              <td
                style={{
                  ...cellBase,
                  width: m.colWidth * 0.9, minWidth: m.colWidth * 0.9,
                  textAlign: "left",
                  paddingLeft: 4,
                  color: "hsl(var(--foreground) / 0.85)",
                }}
              >
                {i > 0 && (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-foreground/60">R</span>
                    <SmartCell value={row.r} onChange={(v) => setR(i, v)} align="left" placeholder="0" />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BaseConversion;
