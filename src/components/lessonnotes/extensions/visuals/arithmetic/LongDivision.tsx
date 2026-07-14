import { Fragment } from "react";
// Long Division — classic ") ‾‾‾‾" bracket layout.
// Editable divisor, dividend, quotient (over the bar), and unlimited
// working rows below. Every cell is a Smart Cell.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";

interface Attrs {
  divisor?: string;
  dividend?: string;
  quotient?: string;
  workingRows?: string[];   // each row is free text (space-separated digits)
  showWorking?: boolean;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

function normalize(a: Record<string, unknown>): Required<Attrs> {
  return {
    divisor: typeof a.divisor === "string" ? a.divisor : "12",
    dividend: typeof a.dividend === "string" ? a.dividend : "14568",
    quotient: typeof a.quotient === "string" ? a.quotient : "",
    workingRows: Array.isArray(a.workingRows) ? (a.workingRows as string[]) : [""],
    showWorking: a.showWorking === undefined ? true : Boolean(a.showWorking),
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

  return (
    <div className="not-prose inline-block font-mono text-foreground relative">
      {selected && (
        <div className="absolute -top-6 right-0 flex items-center gap-1">
          <Chip onClick={addRow}><Plus className="h-3 w-3"/> row</Chip>
          <Chip onClick={delRow}><Minus className="h-3 w-3"/> row</Chip>
          <Chip onClick={() => patch({ showWorking: !m.showWorking })}>
            {m.showWorking ? "hide" : "show"} working
          </Chip>
        </div>
      )}

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
        <div className="border-t-2 border-foreground pt-0.5 text-right pr-2">
          <SmartCell value={m.dividend} onChange={(v) => patch({ dividend: v })} align="right" placeholder="dividend" />
        </div>
      </div>

      {/* Working rows */}
      {m.showWorking && m.workingRows.length > 0 && (
        <div className="grid mt-0.5" style={{ gridTemplateColumns: "auto auto 1fr" }}>
          {m.workingRows.map((row, i) => (
            <Fragment key={i}>
              <div />
              <div />
              <div className="text-right pr-2 border-t border-foreground/60 py-0.5">
                <SmartCell
                  value={row}
                  onChange={(v) => setRow(i, v)}
                  align="right"
                  placeholder="working"
                  minWidth="6ch"
                />
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-0.5 rounded border border-foreground/30 bg-background/60 px-1.5 py-0.5 text-[10px] hover:bg-foreground/10"
    >{children}</button>
  );
}

export default LongDivision;
