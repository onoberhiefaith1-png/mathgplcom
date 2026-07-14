// Long Division — classic ") ‾‾‾‾" bracket layout. Opens empty: no
// preset divisor, dividend, quotient, or working rows. Each press of
// "+ Step" adds a pair of working rows: row 1 (product), row 2
// (subtraction — automatically gets a minus sign and a horizontal line).
// Advanced settings live in the right-hand Properties Panel.

import { Fragment, useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { useHoverIdleVisibility } from "@/hooks/useHoverIdleVisibility";
import {
  PanelGroup, PanelRow, PanelNumber, PanelToggle,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { AssetBottomToolbar } from "@/components/lessonnotes/panel/AssetBottomToolbar";

interface Attrs {
  divisor?: string;
  dividend?: string;
  quotient?: string;
  workingRows?: string[];
  showWorking?: boolean;
  autoMinus?: boolean;
  autoLine?: boolean;
  lineThickness?: number;
  rowHeight?: number;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

function normalize(a: Record<string, unknown>): Required<Attrs> {
  return {
    divisor: typeof a.divisor === "string" ? a.divisor : "",
    dividend: typeof a.dividend === "string" ? a.dividend : "",
    quotient: typeof a.quotient === "string" ? a.quotient : "",
    workingRows: Array.isArray(a.workingRows) ? (a.workingRows as string[]) : [],
    showWorking: a.showWorking === undefined ? true : Boolean(a.showWorking),
    autoMinus: a.autoMinus === undefined ? true : Boolean(a.autoMinus),
    autoLine: a.autoLine === undefined ? true : Boolean(a.autoLine),
    lineThickness: Number(a.lineThickness) || 3,
    rowHeight: Number(a.rowHeight) || 36,
  };
}

export function LongDivision({ attrs, onChange, selected }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);

  const setRow = (i: number, v: string) => {
    const rows = [...m.workingRows]; rows[i] = v; patch({ workingRows: rows });
  };
  // Each "step" is a pair of rows: product line + subtraction line.
  const addStep = () => patch({ workingRows: [...m.workingRows, "", ""] });
  const delStep = () => m.workingRows.length > 0 &&
    patch({ workingRows: m.workingRows.slice(0, Math.max(0, m.workingRows.length - 2)) });

  const editor = useMemo(() => (
    <div>
      <PanelGroup label="Behaviour">
        <PanelRow label="Auto minus (every 2 rows)"><PanelToggle value={m.autoMinus} onChange={(v) => patch({ autoMinus: v })} /></PanelRow>
        <PanelRow label="Auto horizontal line"><PanelToggle value={m.autoLine} onChange={(v) => patch({ autoLine: v })} /></PanelRow>
        <PanelRow label="Show working"><PanelToggle value={m.showWorking} onChange={(v) => patch({ showWorking: v })} /></PanelRow>
      </PanelGroup>
      <PanelGroup label="Sizing">
        <PanelRow label="Line thickness"><PanelNumber value={m.lineThickness} min={1} max={6} onChange={(v) => patch({ lineThickness: v })} /></PanelRow>
        <PanelRow label="Row height"><PanelNumber value={m.rowHeight} min={20} max={60} onChange={(v) => patch({ rowHeight: v })} /></PanelRow>
      </PanelGroup>
    </div>
  ), [m.autoMinus, m.autoLine, m.showWorking, m.lineThickness, m.rowHeight, patch]);
  useRegisterAssetEditor(!!selected, "longDivision", "Long division", editor);

  const { visible: toolbarVisible, bind } = useHoverIdleVisibility({ idleMs: 10000, forceVisible: !!selected });

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
      {/* Quotient (above the bar) */}
      <div className="grid" style={{ gridTemplateColumns: "auto auto 1fr", alignItems: "end", fontSize: 22 }}>
        <div />
        <div />
        <div className="text-right pr-2 pb-0.5">
          <SmartCell value={m.quotient} onChange={(v) => patch({ quotient: v })} placeholder="" align="right" />
        </div>

        {/* Divisor ) dividend */}
        <div className="pr-1 self-center">
          <SmartCell value={m.divisor} onChange={(v) => patch({ divisor: v })} align="right" placeholder="" />
        </div>
        <div className="self-center pr-1" style={{ fontSize: 26, fontWeight: 700 }}>)</div>
        <div
          className="text-right pr-2"
          style={{
            borderTop: `${m.lineThickness}px solid #0f172a`,
            paddingTop: 2,
            minWidth: "5ch",
          }}
        >
          <SmartCell value={m.dividend} onChange={(v) => patch({ dividend: v })} align="right" placeholder="" />
        </div>
      </div>

      {/* Working rows */}
      {m.showWorking && m.workingRows.length > 0 && (
        <div className="grid mt-0.5" style={{ gridTemplateColumns: "auto auto 1fr", fontSize: 22 }}>
          {m.workingRows.map((row, i) => {
            const showMinus = m.autoMinus && i % 2 === 0;
            const showLine = m.autoLine && i % 2 === 1;
            return (
              <Fragment key={i}>
                <div />
                <div className="text-right self-center pr-1" style={{ fontWeight: 700 }}>
                  {showMinus ? "−" : ""}
                </div>
                <div
                  className="text-right pr-2 py-0.5"
                  style={{
                    height: m.rowHeight,
                    borderTop: showLine ? `${m.lineThickness}px solid #0f172a` : undefined,
                  }}
                >
                  <SmartCell
                    value={row}
                    onChange={(v) => setRow(i, v)}
                    align="right"
                    placeholder=""
                    minWidth="6ch"
                  />
                </div>
              </Fragment>
            );
          })}
        </div>
      )}

      <AssetBottomToolbar
        visible={!!selected}
        actions={[
          { label: "Working step", icon: <Plus className="h-3 w-3" />, onClick: addStep },
          { label: "Working step", icon: <Minus className="h-3 w-3" />, onClick: delStep, disabled: m.workingRows.length === 0, tone: "danger" },
        ]}
      />
    </div>
  );
}

export default LongDivision;
