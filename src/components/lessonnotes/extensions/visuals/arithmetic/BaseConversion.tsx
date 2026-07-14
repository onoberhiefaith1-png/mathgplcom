// Number-Base Conversion — repeated-division layout with one visible
// vertical divider. Opens empty (no seeded base or rows). "R" marks the
// remainder column (invisible cells so digits stay aligned). Advanced
// settings in the right-hand Properties Panel; row buttons in the bottom
// toolbar.

import { useCallback, useMemo } from "react";
import { useHoverIdleVisibility } from "@/hooks/useHoverIdleVisibility";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import {
  PanelGroup, PanelRow, PanelNumber,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { AssetBottomToolbar } from "@/components/lessonnotes/panel/AssetBottomToolbar";

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
    base: typeof a.base === "string" ? a.base : "",
    rows: Array.isArray(a.rows) && (a.rows as any[]).length
      ? (a.rows as Array<{ q: string; r: string }>)
      : [{ q: "", r: "" }],
    fontSize: Number(a.fontSize) || 22,
    rowHeight: Number(a.rowHeight) || 40,
    colWidth: Number(a.colWidth) || 68,
    dividerThickness: Number(a.dividerThickness) || 3,
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
  useRegisterAssetEditor(!!selected, "baseConversion", "Base conversion", editor);

  const { visible: toolbarVisible, bind } = useHoverIdleVisibility({ idleMs: 10000, forceVisible: !!selected });

  const cellBase: React.CSSProperties = {
    height: m.rowHeight,
    fontSize: m.fontSize,
    verticalAlign: "middle",
    padding: 0,
    color: "#0f172a",
    fontWeight: 500,
  };

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
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {m.rows.map((row, i) => (
            <tr key={i}>
              <td
                style={{
                  ...cellBase,
                  width: 44, minWidth: 44,
                  textAlign: "right",
                  paddingRight: 10,
                  borderRight: `${m.dividerThickness}px solid #0f172a`,
                }}
              >
                <SmartCell value={m.base} onChange={(v) => patch({ base: v })} align="right" placeholder="" />
              </td>
              <td
                style={{
                  ...cellBase,
                  width: m.colWidth, minWidth: m.colWidth,
                  textAlign: "right",
                  paddingLeft: 14, paddingRight: 14,
                }}
              >
                <SmartCell value={row.q} onChange={(v) => setQ(i, v)} align="right" placeholder="" />
              </td>
              <td
                style={{
                  ...cellBase,
                  width: m.colWidth * 0.9, minWidth: m.colWidth * 0.9,
                  textAlign: "left",
                  paddingLeft: 4,
                }}
              >
                {i > 0 && (
                  <span className="inline-flex items-center gap-2">
                    <span style={{ fontWeight: 700 }}>R</span>
                    <SmartCell value={row.r} onChange={(v) => setR(i, v)} align="left" placeholder="" />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <AssetBottomToolbar
        visible={toolbarVisible}
        bind={bind}
        actions={[
          { label: "Row", icon: <Plus className="h-3 w-3" />, onClick: addRow },
          { label: "Row", icon: <Minus className="h-3 w-3" />, onClick: delRow, disabled: m.rows.length <= 1, tone: "danger" },
        ]}
      />
    </div>
  );
}

export default BaseConversion;
