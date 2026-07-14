// Fraction Wall — stacked strips, each split into N equal partitions.
// Teacher can add/remove rows, change partitions per row, edit label,
// toggle shaded cells.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";

interface Row {
  parts: number;
  label: string;
  shaded: boolean[];   // length = parts
  color: string;
}

interface Attrs { rows?: Row[]; width?: number }

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

function normalizeRow(r: Partial<Row>): Row {
  const parts = Math.max(1, Number(r.parts) || 1);
  const shaded = Array.isArray(r.shaded) ? [...r.shaded] : [];
  while (shaded.length < parts) shaded.push(false);
  shaded.length = parts;
  return {
    parts,
    label: typeof r.label === "string" ? r.label : (parts === 1 ? "1" : `1/${parts}`),
    shaded,
    color: typeof r.color === "string" ? r.color : "hsl(var(--primary))",
  };
}

function normalize(a: Record<string, unknown>): Required<Attrs> {
  const rows = Array.isArray(a.rows) ? (a.rows as Row[]).map(normalizeRow) : [
    normalizeRow({ parts: 1 }),
    normalizeRow({ parts: 2 }),
    normalizeRow({ parts: 3 }),
    normalizeRow({ parts: 4 }),
  ];
  return { rows, width: Number(a.width) || 320 };
}

export function FractionWall({ attrs, onChange, selected }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);

  const setRow = (i: number, r: Partial<Row>) => {
    const rows = m.rows.map((x) => ({ ...x })); rows[i] = normalizeRow({ ...rows[i], ...r });
    patch({ rows });
  };
  const toggleCell = (i: number, c: number) => {
    const rows = m.rows.map((x) => ({ ...x, shaded: [...x.shaded] }));
    rows[i].shaded[c] = !rows[i].shaded[c];
    patch({ rows });
  };
  const addRow = () => patch({ rows: [...m.rows, normalizeRow({ parts: (m.rows[m.rows.length-1]?.parts ?? 4) + 1 })] });
  const delRow = () => m.rows.length > 1 && patch({ rows: m.rows.slice(0, -1) });

  return (
    <div className="not-prose inline-block relative">
      {selected && (
        <div className="absolute -top-6 right-0 flex items-center gap-1">
          <Chip onClick={addRow}><Plus className="h-3 w-3"/> row</Chip>
          <Chip onClick={delRow}><Minus className="h-3 w-3"/> row</Chip>
        </div>
      )}
      <div style={{ width: m.width }} className="space-y-1">
        {m.rows.map((row, ri) => (
          <div key={ri} className="flex items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => setRow(ri, { label: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="w-14 text-xs bg-transparent border-b border-foreground/20 focus:border-primary outline-none px-1 py-0.5 text-foreground"
            />
            <div className="flex-1 flex border border-foreground/60 rounded overflow-hidden" style={{ height: 22 }}>
              {row.shaded.map((on, ci) => (
                <button
                  key={ci}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleCell(ri, ci); }}
                  className={"flex-1 border-r border-foreground/40 last:border-r-0 transition-colors " + (on ? "" : "hover:bg-foreground/5")}
                  style={{ background: on ? row.color : "transparent" }}
                  aria-label={`row ${ri+1} cell ${ci+1}`}
                />
              ))}
            </div>
            {selected && (
              <div className="flex items-center gap-0.5">
                <Chip onClick={() => setRow(ri, { parts: row.parts + 1 })}><Plus className="h-3 w-3"/></Chip>
                <Chip onClick={() => setRow(ri, { parts: Math.max(1, row.parts - 1) })}><Minus className="h-3 w-3"/></Chip>
                <input
                  type="color" value={/^#/.test(row.color) ? row.color : "#3b82f6"}
                  onChange={(e) => setRow(ri, { color: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border border-foreground/30 bg-transparent cursor-pointer"
                />
              </div>
            )}
          </div>
        ))}
      </div>
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

export default FractionWall;
