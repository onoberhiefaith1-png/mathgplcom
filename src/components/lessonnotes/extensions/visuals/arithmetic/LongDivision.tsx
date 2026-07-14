// Long Division — classic ") ‾‾‾‾" bracket layout.
// Editable divisor, dividend, quotient (over the bar), and unlimited
// working rows below. Every two working rows automatically get a
// subtraction line + minus sign when Auto mode is on.
// Editing lives in the right-hand Properties Panel.

import { Fragment, useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelToggle,
} from "@/components/lessonnotes/panel/panelPrimitives";

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
    divisor: typeof a.divisor === "string" ? a.divisor : "12",
    dividend: typeof a.dividend === "string" ? a.dividend : "3648",
    quotient: typeof a.quotient === "string" ? a.quotient : "",
    workingRows: Array.isArray(a.workingRows) ? (a.workingRows as string[]) : ["", ""],
    showWorking: a.showWorking === undefined ? true : Boolean(a.showWorking),
    autoMinus: a.autoMinus === undefined ? true : Boolean(a.autoMinus),
    autoLine: a.autoLine === undefined ? true : Boolean(a.autoLine),
    lineThickness: Number(a.lineThickness) || 2,
    rowHeight: Number(a.rowHeight) || 28,
  };
}

export function LongDivision({ attrs, onChange, selected }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);

  const setRow = (i: number, v: string) => {
    const rows = [...m.workingRows]; rows[i] = v; patch({ workingRows: rows });
  };
  const addRow = () => patch({ workingRows: [...m.workingRows, ""] });
  const delRow = () => m.workingRows.length > 0 &&
    patch({ workingRows: m.workingRows.slice(0, -1) });

  const editor = (
    <div>
      <PanelGroup label="Rows">
        <PanelButton full onClick={addRow}><Plus className="h-3 w-3" /> Add working row</PanelButton>
        <PanelButton full onClick={delRow}><Minus className="h-3 w-3" /> Delete last row</PanelButton>
      </PanelGroup>
      <PanelGroup label="Behaviour">
        <PanelRow label="Auto minus (every 2 rows)"><PanelToggle value={m.autoMinus} onChange={(v) => patch({ autoMinus: v })} /></PanelRow>
        <PanelRow label="Auto horizontal line"><PanelToggle value={m.autoLine} onChange={(v) => patch({ autoLine: v })} /></PanelRow>
        <PanelRow label="Show working"><PanelToggle value={m.showWorking} onChange={(v) => patch({ showWorking: v })} /></PanelRow>
      </PanelGroup>
      <PanelGroup label="Sizing">
        <PanelRow label="Line thickness"><PanelNumber value={m.lineThickness} min={1} max={5} onChange={(v) => patch({ lineThickness: v })} /></PanelRow>
        <PanelRow label="Row height"><PanelNumber value={m.rowHeight} min={20} max={60} onChange={(v) => patch({ rowHeight: v })} /></PanelRow>
      </PanelGroup>
    </div>
  );
  useRegisterAssetEditor(!!selected, "longDivision", "Long division", editor);

  return (
    <div className="not-prose inline-block font-mono text-foreground">
      {/* Quotient (above the bar) */}
      <div className="grid" style={{ gridTemplateColumns: "auto auto 1fr", alignItems: "end" }}>
        <div />
        <div />
        <div className="text-right pr-2 pb-0.5">
          <SmartCell value={m.quotient} onChange={(v) => patch({ quotient: v })} placeholder="quotient" align="right" />
        </div>

        {/* Divisor ) dividend */}
        <div className="pr-1 self-center text-lg">
          <SmartCell value={m.divisor} onChange={(v) => patch({ divisor: v })} align="right" placeholder="d" />
        </div>
        <div className="self-center text-lg pr-1">)</div>
        <div
          className="text-right pr-2"
          style={{
            borderTop: `${m.lineThickness}px solid hsl(var(--foreground))`,
            paddingTop: 2,
          }}
        >
          <SmartCell value={m.dividend} onChange={(v) => patch({ dividend: v })} align="right" placeholder="dividend" />
        </div>
      </div>

      {/* Working rows */}
      {m.showWorking && m.workingRows.length > 0 && (
        <div className="grid mt-0.5" style={{ gridTemplateColumns: "auto auto 1fr" }}>
          {m.workingRows.map((row, i) => {
            const showMinus = m.autoMinus && i % 2 === 0;
            const showLine = m.autoLine && i % 2 === 1;
            return (
              <Fragment key={i}>
                <div />
                <div className="text-right self-center pr-1 text-foreground/70">
                  {showMinus ? "−" : ""}
                </div>
                <div
                  className="text-right pr-2 py-0.5"
                  style={{
                    height: m.rowHeight,
                    borderTop: showLine ? `${m.lineThickness}px solid hsl(var(--foreground))` : undefined,
                  }}
                >
                  <SmartCell
                    value={row}
                    onChange={(v) => setRow(i, v)}
                    align="right"
                    placeholder="working"
                    minWidth="6ch"
                  />
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LongDivision;
