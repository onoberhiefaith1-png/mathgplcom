// Simple Pie Chart. One circle divided into percentages that always add
// up to at most 100. Software converts % → 360° internally. Sectors are
// drawn clockwise, starting at 12 o'clock, in the order of the rows in
// the Properties Panel. Full-width like the Bar Chart.

import { useState } from "react";
import { ArrowUp, ArrowDown, Plus, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import {
  PanelGroup, PanelRow, PanelButton, PanelColor, PanelText,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import type { SmartChartAttrs, PieSector, PieLabelMode, ChartKind } from "./types";
import { DEFAULT_PALETTE } from "./types";

interface Props {
  attrs: SmartChartAttrs;
  onChange: (patch: Partial<SmartChartAttrs>) => void;
  selected: boolean;
}

const VB = 400;               // square viewBox
const CX = VB / 2;
const CY = VB / 2;
const R = 150;                // circle radius
const LABEL_R = R * 0.62;     // inside-label position
const OUTSIDE_R = R * 1.12;   // outside-label position (small slices)

function colorFor(sector: PieSector, idx: number, palette: string[]): string {
  if (sector.color) return sector.color;
  const p = palette.length ? palette : DEFAULT_PALETTE;
  return p[idx % p.length];
}

function polar(angleDeg: number, r: number): { x: number; y: number } {
  // 0° = 12 o'clock, clockwise
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number): string {
  const a = polar(startDeg, R);
  const b = polar(endDeg, R);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  // clockwise sweep = 1 (SVG y-axis is inverted)
  return `M ${CX} ${CY} L ${a.x} ${a.y} A ${R} ${R} 0 ${large} 1 ${b.x} ${b.y} Z`;
}

export function PieChart({ attrs, onChange, selected }: Props) {
  const sectors = attrs.pie.sectors;
  const labelMode = attrs.pie.labelMode;
  const palette = attrs.palette;
  const zoom = Math.max(0.5, Math.min(3, attrs.zoom || 1));

  const total = sectors.reduce((s, r) => s + (Number.isFinite(r.value) ? r.value : 0), 0);
  const remaining = Math.max(0, 100 - total);

  const patchPie = (p: Partial<SmartChartAttrs["pie"]>) =>
    onChange({ pie: { ...attrs.pie, ...p } });

  // Error banner for last invalid attempt
  const [error, setError] = useState<string | null>(null);
  const [errorRow, setErrorRow] = useState<number | null>(null);

  const setSector = (i: number, patch: Partial<PieSector>) => {
    const next = sectors.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    patchPie({ sectors: next });
  };

  const tryUpdatePercent = (i: number, raw: number) => {
    const others = sectors.reduce((s, r, idx) => idx === i ? s : s + (r.value || 0), 0);
    if (!Number.isFinite(raw) || raw < 0) {
      setSector(i, { value: 0 });
      setError(null); setErrorRow(null);
      return;
    }
    if (raw > 100) {
      setError("A single section cannot exceed 100% of the pie chart.");
      setErrorRow(i);
      return;
    }
    if (raw + others > 100 + 0.0001) {
      const rem = Math.max(0, 100 - others);
      setError(`Only ${formatPct(rem)}% remains. Please enter a value less than or equal to ${formatPct(rem)}%.`);
      setErrorRow(i);
      return;
    }
    setError(null); setErrorRow(null);
    setSector(i, { value: raw });
  };

  const addSection = () => {
    if (remaining <= 0) {
      setError("The pie chart is already full (100%).");
      setErrorRow(null);
      return;
    }
    setError(null); setErrorRow(null);
    const idx = sectors.length;
    const next: PieSector = {
      name: `Section ${idx + 1}`,
      value: 0,
      color: DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
    };
    patchPie({ sectors: [...sectors, next] });
  };
  const delSection = (i: number) => {
    patchPie({ sectors: sectors.filter((_, idx) => idx !== i) });
    if (errorRow === i) { setError(null); setErrorRow(null); }
  };
  const moveSection = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sectors.length) return;
    const next = sectors.slice();
    [next[i], next[j]] = [next[j], next[i]];
    patchPie({ sectors: next });
  };

  // ---- Editor (right-hand Properties Panel) ------------------------
  const editor = (
    <div>
      <PanelGroup label="Chart type">
        <PanelRow label="Kind">
          <select
            value={attrs.kind}
            onChange={(e) => onChange({ kind: e.target.value as ChartKind })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground"
          >
            <option value="bar">Bar chart</option>
            <option value="histogram">Histogram</option>
            <option value="pie">Pie chart</option>
          </select>
        </PanelRow>
        <PanelRow label="Title">
          <PanelText value={attrs.title} onChange={(v) => onChange({ title: v })} />
        </PanelRow>
        <PanelRow label="Zoom">
          <PanelButton onClick={() => onChange({ zoom: Math.max(0.5, +(zoom - 0.1).toFixed(2)) })}><ZoomOut className="h-3 w-3" /></PanelButton>
          <span className="px-1 text-[11px] tabular-nums">{Math.round(zoom * 100)}%</span>
          <PanelButton onClick={() => onChange({ zoom: Math.min(3, +(zoom + 0.1).toFixed(2)) })}><ZoomIn className="h-3 w-3" /></PanelButton>
          <PanelButton onClick={() => onChange({ zoom: 1 })}>Reset</PanelButton>
        </PanelRow>
      </PanelGroup>

      <PanelGroup label="Sections">
        {sectors.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            Press <b>Add section</b> below to start. Each section shows a category name and its percentage.
          </div>
        )}
        {sectors.map((s, i) => (
          <div key={i} className="mb-2 rounded border border-foreground/10 p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-foreground/20"
                style={{ background: colorFor(s, i, palette) }}
                aria-hidden
              />
              <input
                type="text"
                value={s.name}
                placeholder="Category"
                onChange={(e) => setSector(i, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 rounded border border-foreground/20 bg-background px-1.5 py-0.5 text-xs text-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={s.value}
                onChange={(e) => tryUpdatePercent(i, Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-20 rounded border border-foreground/20 bg-background px-1.5 py-0.5 text-xs text-foreground text-right"
              />
              <span className="text-[11px] text-muted-foreground">%</span>
              <div className="ml-auto flex items-center gap-1">
                <PanelColor
                  value={colorFor(s, i, palette)}
                  onChange={(v) => setSector(i, { color: v })}
                />
                <PanelButton onClick={() => moveSection(i, -1)}><ArrowUp className="h-3 w-3" /></PanelButton>
                <PanelButton onClick={() => moveSection(i, 1)}><ArrowDown className="h-3 w-3" /></PanelButton>
                <PanelButton onClick={() => delSection(i)} variant="danger"><Trash2 className="h-3 w-3" /></PanelButton>
              </div>
            </div>
            {errorRow === i && error && (
              <div className="text-[11px] text-destructive">{error}</div>
            )}
          </div>
        ))}
        <PanelButton onClick={addSection} full>
          <Plus className="h-3 w-3" /> Add section
        </PanelButton>
        {errorRow === null && error && (
          <div className="mt-1 text-[11px] text-destructive">{error}</div>
        )}
      </PanelGroup>

      <PanelGroup label="Totals">
        <PanelRow label="Current total">
          <span className="tabular-nums text-foreground">{formatPct(total)}%</span>
        </PanelRow>
        <PanelRow label="Remaining">
          <span
            className={
              "tabular-nums " + (total > 100 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")
            }
          >
            {formatPct(remaining)}%
          </span>
        </PanelRow>
      </PanelGroup>

      <PanelGroup label="Labels">
        <PanelRow label="Show">
          <select
            value={labelMode}
            onChange={(e) => patchPie({ labelMode: e.target.value as PieLabelMode })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground"
          >
            <option value="category">Category only</option>
            <option value="percent">Percentage only</option>
            <option value="category+percent">Category + Percentage</option>
            <option value="none">None</option>
          </select>
        </PanelRow>
      </PanelGroup>
    </div>
  );

  useRegisterAssetEditor(!!selected, "smartChart-pie", "Pie chart", editor);

  // ---- Rendering ---------------------------------------------------
  // Build the sector geometry
  let cursor = 0;
  const drawn = sectors
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const startDeg = (cursor / 100) * 360;
      const endDeg = ((cursor + s.value) / 100) * 360;
      const midDeg = (startDeg + endDeg) / 2;
      cursor += s.value;
      return {
        sector: s,
        i,
        startDeg,
        endDeg,
        midDeg,
        color: colorFor(s, i, palette),
      };
    });

  const hasAny = drawn.length > 0;
  const remainingArcStart = (total / 100) * 360;

  return (
    <div className="w-full">
      {attrs.title && (
        <div
          className="mb-1 text-center font-semibold text-foreground"
          style={{ fontSize: attrs.fonts.size + 2 }}
        >
          {attrs.title}
        </div>
      )}
      <div className="w-full flex justify-center">
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          className="block"
          style={{ width: "min(100%, 520px)", height: "auto" }}
          role="img"
          aria-label="Pie chart"
        >
          {/* Empty state: outlined circle only */}
          {!hasAny && (
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="transparent"
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1.5}
            />
          )}

          {/* Drawn sectors */}
          {drawn.map((d, idx) => {
            // A single sector at 100% renders as full circle
            if (d.endDeg - d.startDeg >= 359.9999) {
              return (
                <circle
                  key={idx}
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill={d.color}
                  stroke="#0f172a"
                  strokeWidth={1.2}
                />
              );
            }
            return (
              <path
                key={idx}
                d={arcPath(d.startDeg, d.endDeg)}
                fill={d.color}
                stroke="#0f172a"
                strokeWidth={1.2}
              />
            );
          })}

          {/* Remaining arc (dashed outline) */}
          {hasAny && total < 100 - 0.0001 && (
            <path
              d={arcPath(remainingArcStart, 360)}
              fill="transparent"
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}

          {/* Labels */}
          {labelMode !== "none" &&
            drawn.map((d, idx) => {
              const size = d.endDeg - d.startDeg;
              const isSmall = size < 22; // ~ <6%
              const pos = isSmall ? polar(d.midDeg, OUTSIDE_R) : polar(d.midDeg, LABEL_R);
              const inner = polar(d.midDeg, R * 0.98);
              const outer = polar(d.midDeg, OUTSIDE_R * 0.95);
              const pctText = `${formatPct(d.sector.value)}%`;
              const nameText = d.sector.name || `Section ${d.i + 1}`;
              const showName = labelMode === "category" || labelMode === "category+percent";
              const showPct = labelMode === "percent" || labelMode === "category+percent";

              const anchor = isSmall
                ? pos.x >= CX ? "start" : "end"
                : "middle";
              const dxNudge = isSmall ? (pos.x >= CX ? 2 : -2) : 0;

              return (
                <g key={`lbl-${idx}`}>
                  {isSmall && (
                    <line
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="currentColor"
                      strokeOpacity={0.5}
                      strokeWidth={0.8}
                    />
                  )}
                  {showName && (
                    <text
                      x={pos.x + dxNudge}
                      y={pos.y + (showPct ? -4 : 4)}
                      textAnchor={anchor}
                      fontSize={13}
                      fontWeight={600}
                      fill={isSmall ? "currentColor" : "#0f172a"}
                    >
                      {nameText}
                    </text>
                  )}
                  {showPct && (
                    <text
                      x={pos.x + dxNudge}
                      y={pos.y + (showName ? 12 : 5)}
                      textAnchor={anchor}
                      fontSize={12}
                      fill={isSmall ? "currentColor" : "#0f172a"}
                    >
                      {pctText}
                    </text>
                  )}
                </g>
              );
            })}
        </svg>
      </div>

      {/* Compact totals strip under the chart, always visible */}
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span>Total: <span className="tabular-nums text-foreground">{formatPct(total)}%</span></span>
        <span>Remaining: <span
          className={
            "tabular-nums " + (total > 100 ? "text-destructive" : total < 100 ? "text-foreground" : "text-emerald-600 dark:text-emerald-400")
          }
        >{formatPct(remaining)}%</span></span>
      </div>
    </div>
  );
}

function formatPct(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
