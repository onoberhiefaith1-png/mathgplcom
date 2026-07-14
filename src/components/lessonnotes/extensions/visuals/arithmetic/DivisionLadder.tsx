// Division Ladder — one structure that becomes HCF, LCM, or prime
// factorisation. Left column is the divisor for the row; the right side
// holds one column per number. Add divisor rows (down) or number columns
// (right) as needed. Every cell is a Smart Cell.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";

interface Attrs {
  divisors?: string[];        // one per working row
  values?: string[][];        // rows × cols; last row is the reduced result
  cols?: number;              // number of numbers being reduced
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

function normalize(a: Record<string, unknown>): { divisors: string[]; values: string[][]; cols: number } {
  const cols = Math.max(1, Number(a.cols) || 2);
  const divisors: string[] = Array.isArray(a.divisors) ? [...(a.divisors as string[])] : ["2", "2", "3"];
  // values has divisors.length + 1 rows (last row = reduced result)
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
  return { divisors, values, cols };
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
    // insert a blank working row before the final "result" row
    nv.splice(nv.length - 1, 0, Array.from({ length: m.cols }, () => ""));
    patch({ divisors: nd, values: nv });
  };
  const delRow = () => {
    if (m.divisors.length <= 1) return;
    const nd = m.divisors.slice(0, -1);
    const nv = [...m.values]; nv.splice(nv.length - 2, 1);
    patch({ divisors: nd, values: nv });
  };
  const addCol = () => {
    patch({
      cols: m.cols + 1,
      values: m.values.map((row) => [...row, ""]),
    });
  };
  const delCol = () => {
    if (m.cols <= 1) return;
    patch({
      cols: m.cols - 1,
      values: m.values.map((row) => row.slice(0, -1)),
    });
  };

  return (
    <div className="not-prose inline-block font-mono text-foreground relative">
      {selected && (
        <div className="absolute -top-6 right-0 flex items-center gap-1">
          <Chip onClick={addRow}><Plus className="h-3 w-3"/> row</Chip>
          <Chip onClick={delRow}><Minus className="h-3 w-3"/> row</Chip>
          <span className="mx-1 h-3 w-px bg-foreground/30" />
          <Chip onClick={addCol}><Plus className="h-3 w-3"/> col</Chip>
          <Chip onClick={delCol}><Minus className="h-3 w-3"/> col</Chip>
        </div>
      )}
      <table className="border-collapse">
        <tbody>
          {m.values.map((row, r) => {
            const isResult = r === m.values.length - 1;
            return (
              <tr key={r}>
                <td className="pr-2 text-right border-r-2 border-foreground">
                  {isResult ? (
                    <span className="opacity-0 select-none">·</span>
                  ) : (
                    <SmartCell value={m.divisors[r] ?? ""} onChange={(v) => setDiv(r, v)} align="right" placeholder="d" />
                  )}
                </td>
                {row.map((v, c) => (
                  <td key={c} className={"pl-3 pr-1 py-0.5 text-right " + (isResult ? "font-bold border-t border-foreground/60" : "")}>
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

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-0.5 rounded border border-foreground/30 bg-background/60 px-1.5 py-0.5 text-[10px] hover:bg-foreground/10"
    >{children}</button>
  );
}

export default DivisionLadder;
