// Place-Value Chart — editable whole-number columns (M, HTh, TTh, Th, H,
// T, U) and optional decimal columns (t, h, th, tth). A decimal point sits
// between the two halves. Every value cell is a Smart Cell.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";

interface Attrs {
  wholeHeaders?: string[];
  decimalHeaders?: string[];
  values?: string[];        // whole values, left→right
  decValues?: string[];     // decimal values, left→right
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

const DEFAULT_WHOLE = ["HTh", "TTh", "Th", "H", "T", "U"];
const DEFAULT_DEC: string[] = [];

function normalize(a: Record<string, unknown>): Required<Attrs> {
  const wholeHeaders = Array.isArray(a.wholeHeaders) && a.wholeHeaders.length
    ? (a.wholeHeaders as string[]) : DEFAULT_WHOLE;
  const decimalHeaders = Array.isArray(a.decimalHeaders)
    ? (a.decimalHeaders as string[]) : DEFAULT_DEC;
  const values = Array.isArray(a.values) ? (a.values as string[]) : [];
  const decValues = Array.isArray(a.decValues) ? (a.decValues as string[]) : [];
  while (values.length < wholeHeaders.length) values.push("");
  values.length = wholeHeaders.length;
  while (decValues.length < decimalHeaders.length) decValues.push("");
  decValues.length = decimalHeaders.length;
  return { wholeHeaders, decimalHeaders, values, decValues };
}

export function PlaceValueChart({ attrs, onChange, selected }: Props) {
  const model = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);

  const setHeader = (side: "whole" | "dec", i: number, v: string) => {
    if (side === "whole") {
      const h = [...model.wholeHeaders]; h[i] = v; patch({ wholeHeaders: h });
    } else {
      const h = [...model.decimalHeaders]; h[i] = v; patch({ decimalHeaders: h });
    }
  };
  const setValue = (side: "whole" | "dec", i: number, v: string) => {
    if (side === "whole") { const a = [...model.values]; a[i] = v; patch({ values: a }); }
    else { const a = [...model.decValues]; a[i] = v; patch({ decValues: a }); }
  };
  const addWholeCol = () => patch({
    wholeHeaders: ["", ...model.wholeHeaders], values: ["", ...model.values],
  });
  const delWholeCol = () => model.wholeHeaders.length > 1 && patch({
    wholeHeaders: model.wholeHeaders.slice(1), values: model.values.slice(1),
  });
  const addDecCol = () => patch({
    decimalHeaders: [...model.decimalHeaders, ""], decValues: [...model.decValues, ""],
  });
  const delDecCol = () => model.decimalHeaders.length > 0 && patch({
    decimalHeaders: model.decimalHeaders.slice(0, -1), decValues: model.decValues.slice(0, -1),
  });

  const cellCls =
    "border border-foreground/50 min-w-[3ch] px-2 py-1 text-center align-middle";

  return (
    <div className="not-prose inline-block relative">
      {selected && (
        <div className="absolute -top-6 left-0 right-0 flex justify-between text-[10px] uppercase tracking-wider text-foreground/60">
          <div className="flex items-center gap-1">
            <Chip onClick={addWholeCol}><Plus className="h-3 w-3"/> col</Chip>
            <Chip onClick={delWholeCol}><Minus className="h-3 w-3"/> col</Chip>
            <span className="opacity-60">whole</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="opacity-60">decimal</span>
            <Chip onClick={addDecCol}><Plus className="h-3 w-3"/> col</Chip>
            <Chip onClick={delDecCol}><Minus className="h-3 w-3"/> col</Chip>
          </div>
        </div>
      )}
      <table className="border-collapse text-foreground">
        <thead>
          <tr>
            {model.wholeHeaders.map((h, i) => (
              <th key={"wh"+i} className={cellCls + " font-semibold text-[11px] uppercase tracking-wide text-foreground/70"}>
                <SmartCell value={h} onChange={(v) => setHeader("whole", i, v)} placeholder="col" />
              </th>
            ))}
            {model.decimalHeaders.length > 0 && (
              <th className="px-1 text-center align-bottom text-lg font-bold">.</th>
            )}
            {model.decimalHeaders.map((h, i) => (
              <th key={"dh"+i} className={cellCls + " font-semibold text-[11px] uppercase tracking-wide text-foreground/70"}>
                <SmartCell value={h} onChange={(v) => setHeader("dec", i, v)} placeholder="col" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {model.values.map((v, i) => (
              <td key={"wv"+i} className={cellCls}>
                <SmartCell value={v} onChange={(nv) => setValue("whole", i, nv)} />
              </td>
            ))}
            {model.decimalHeaders.length > 0 && (
              <td className="px-1 text-center text-lg font-bold">.</td>
            )}
            {model.decValues.map((v, i) => (
              <td key={"dv"+i} className={cellCls}>
                <SmartCell value={v} onChange={(nv) => setValue("dec", i, nv)} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
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

export default PlaceValueChart;
