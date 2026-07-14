// Fraction Wall — stacked strips, each split into N equal partitions.
// Editing lives in the right-hand Properties Panel.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelColor,
} from "@/components/lessonnotes/panel/panelPrimitives";

interface Row {
  parts: number;
  label: string;
  shaded: boolean[];
  color: string;
}

interface Attrs { rows?: Row[]; width?: number; maxDenominator?: number }

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
    color: typeof r.color === "string" ? r.color : "#3b82f6",
  };
}

function normalize(a: Record<string, unknown>): Required<Attrs> {
  const rows = Array.isArray(a.rows) ? (a.rows as Row[]).map(normalizeRow) : [
    normalizeRow({ parts: 1 }),
    normalizeRow({ parts: 2 }),
    normalizeRow({ parts: 3 }),
    normalizeRow({ parts: 4 }),
  ];
  return {
    rows,
    width: Number(a.width) || 340,
    maxDenominator: Number(a.maxDenominator) || 12,
  };
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
  const addRow = () => {
    const nextParts = Math.min(m.maxDenominator, (m.rows[m.rows.length - 1]?.parts ?? 4) + 1);
    patch({ rows: [...m.rows, normalizeRow({ parts: nextParts })] });
  };
  const delRow = () => m.rows.length > 1 && patch({ rows: m.rows.slice(0, -1) });

  const editor = (
    <div>
      <PanelGroup label="Rows">
        <PanelRow label="Number of rows">
          <PanelButton onClick={delRow}><Minus className="h-3 w-3" /></PanelButton>
          <span className="tabular-nums w-4 text-center">{m.rows.length}</span>
          <PanelButton onClick={addRow}><Plus className="h-3 w-3" /></PanelButton>
        </PanelRow>
        <PanelRow label="Max denominator">
          <PanelNumber value={m.maxDenominator} min={2} max={24} onChange={(v) => patch({ maxDenominator: v })} />
        </PanelRow>
      </PanelGroup>
      <PanelGroup label="Per-row">
        {m.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1 text-xs">
            <span className="w-10 text-foreground/60">{row.label}</span>
            <PanelButton onClick={() => setRow(i, { parts: Math.max(1, row.parts - 1) })}><Minus className="h-3 w-3" /></PanelButton>
            <span className="tabular-nums w-6 text-center">{row.parts}</span>
            <PanelButton onClick={() => setRow(i, { parts: Math.min(m.maxDenominator, row.parts + 1) })}><Plus className="h-3 w-3" /></PanelButton>
            <PanelColor value={row.color} onChange={(v) => setRow(i, { color: v })} />
          </div>
        ))}
      </PanelGroup>
    </div>
  );
  useRegisterAssetEditor(!!selected, "fractionWall", "Fraction wall", editor);

  return (
    <div className="not-prose inline-block">
      <div style={{ width: m.width }} className="space-y-1">
        {m.rows.map((row, ri) => (
          <div key={ri} className="flex items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => setRow(ri, { label: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="w-14 text-xs bg-transparent border-b border-foreground/20 focus:border-primary outline-none px-1 py-0.5 text-foreground"
            />
            <div className="flex-1 flex border-2 border-foreground/70 rounded overflow-hidden" style={{ height: 26 }}>
              {row.shaded.map((on, ci) => (
                <button
                  key={ci}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleCell(ri, ci); }}
                  className={"flex-1 border-r border-foreground/50 last:border-r-0 transition-colors " + (on ? "" : "hover:bg-foreground/5")}
                  style={{ background: on ? row.color : "transparent" }}
                  aria-label={`row ${ri + 1} cell ${ci + 1}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FractionWall;
