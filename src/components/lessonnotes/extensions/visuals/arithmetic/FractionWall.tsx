// Fraction Wall — stacked strips, each split into N equal partitions.
// Opens empty: no default rows. The teacher adds rows via the bottom
// toolbar and configures denominators/colour in the right-hand panel.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { useHoverIdleVisibility } from "@/hooks/useHoverIdleVisibility";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelColor,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { AssetBottomToolbar } from "@/components/lessonnotes/panel/AssetBottomToolbar";

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
  const rows = Array.isArray(a.rows) ? (a.rows as Row[]).map(normalizeRow) : [];
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
    const nextParts = Math.min(m.maxDenominator, (m.rows[m.rows.length - 1]?.parts ?? 0) + 1 || 1);
    patch({ rows: [...m.rows, normalizeRow({ parts: nextParts })] });
  };
  const delRow = () => m.rows.length > 0 && patch({ rows: m.rows.slice(0, -1) });

  const editor = useMemo(() => (
    <div>
      <PanelGroup label="Wall">
        <PanelRow label="Max denominator">
          <PanelNumber value={m.maxDenominator} min={2} max={24} onChange={(v) => patch({ maxDenominator: v })} />
        </PanelRow>
      </PanelGroup>
      {m.rows.length > 0 && (
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
      )}
    </div>
  ), [m.maxDenominator, m.rows, patch]);
  useRegisterAssetEditor(!!selected, "fractionWall", "Fraction wall", editor);

  const { visible: toolbarVisible, bind } = useHoverIdleVisibility({ idleMs: 10000, forceVisible: !!selected });

  return (
    <div
      className="not-prose inline-block"
      onPointerEnter={bind.onPointerEnter}
      onPointerMove={bind.onPointerMove}
      onPointerLeave={bind.onPointerLeave}
      onPointerDown={bind.onPointerDown}
      onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div style={{ width: m.width, minHeight: m.rows.length === 0 ? 30 : undefined }} className="space-y-1">
        {m.rows.length === 0 && selected && (
          <div className="text-xs text-foreground/50 italic px-1">Add a row to start.</div>
        )}
        {m.rows.map((row, ri) => (
          <div key={ri} className="flex items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => setRow(ri, { label: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="w-14 text-xs bg-transparent border-b border-foreground/30 focus:border-primary outline-none px-1 py-0.5"
              style={{ color: "#0f172a" }}
            />
            <div className="flex-1 flex rounded overflow-hidden" style={{ height: 30, border: "2px solid #0f172a" }}>
              {row.shaded.map((on, ci) => (
                <button
                  key={ci}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleCell(ri, ci); }}
                  className="flex-1 transition-colors hover:bg-foreground/5"
                  style={{
                    background: on ? row.color : "transparent",
                    borderRight: ci < row.shaded.length - 1 ? "1.5px solid #0f172a" : undefined,
                  }}
                  aria-label={`row ${ri + 1} cell ${ci + 1}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <AssetBottomToolbar
        visible={toolbarVisible}
        bind={bind}
        actions={[
          { label: "Row", icon: <Plus className="h-3 w-3" />, onClick: addRow },
          { label: "Row", icon: <Minus className="h-3 w-3" />, onClick: delRow, disabled: m.rows.length === 0, tone: "danger" },
        ]}
      />
    </div>
  );
}

export default FractionWall;
