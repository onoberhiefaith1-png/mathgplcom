// Number-Base Conversion — repeated-division layout for decimal → base.
// Header sets the base; each working row = quotient + remainder Smart Cells.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";

interface Attrs {
  base?: string;
  rows?: Array<{ q: string; r: string }>;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

function normalize(a: Record<string, unknown>): Required<Attrs> {
  const base = typeof a.base === "string" ? a.base : "2";
  const rows = Array.isArray(a.rows) ? (a.rows as Array<{ q: string; r: string }>) : [
    { q: "53", r: "" },
    { q: "26", r: "1" },
    { q: "13", r: "0" },
    { q: "6",  r: "1" },
    { q: "3",  r: "0" },
    { q: "1",  r: "1" },
  ];
  return { base, rows };
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

  return (
    <div className="not-prose inline-block font-mono text-foreground relative">
      {selected && (
        <div className="absolute -top-6 right-0 flex items-center gap-1">
          <Chip onClick={addRow}><Plus className="h-3 w-3"/> row</Chip>
          <Chip onClick={delRow}><Minus className="h-3 w-3"/> row</Chip>
        </div>
      )}
      <table className="border-collapse">
        <tbody>
          {m.rows.map((row, i) => (
            <tr key={i}>
              <td className="pr-2 text-right border-r-2 border-foreground">
                <SmartCell value={m.base} onChange={(v) => patch({ base: v })} align="right" placeholder="b" />
              </td>
              <td className="pl-3 pr-3 text-right">
                <SmartCell value={row.q} onChange={(v) => setQ(i, v)} align="right" placeholder="q" />
              </td>
              <td className="pl-2 text-left text-foreground/80">
                {row.r || i > 0 ? (
                  <span>r <SmartCell value={row.r} onChange={(v) => setR(i, v)} align="left" placeholder="0" /></span>
                ) : (
                  <SmartCell value={row.r} onChange={(v) => setR(i, v)} align="left" placeholder="" />
                )}
              </td>
            </tr>
          ))}
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

export default BaseConversion;
