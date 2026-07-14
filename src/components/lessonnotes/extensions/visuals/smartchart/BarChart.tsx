// Interactive Bar Chart — SVG chart plus drag handles on top of every
// bar. All editing happens in the right-hand Properties Panel via
// useRegisterAssetEditor. Defaults to a blank axes canvas with no data
// until the teacher adds a bar.

import { useCallback, useMemo, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelColor, PanelToggle, PanelText,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import type { SmartChartAttrs, BarRow } from "./types";
import { DEFAULT_PALETTE } from "./types";
import { resolveYScale } from "./scale";
import { UniversalTools } from "./UniversalTools";

interface Props {
  attrs: SmartChartAttrs;
  onChange: (patch: Partial<SmartChartAttrs>) => void;
  selected: boolean;
}

// Fixed drawing canvas — the SVG scales responsively via viewBox.
const W = 480;
const H = 300;
const PAD = { top: 24, right: 28, bottom: 56, left: 56 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

export function BarChart({ attrs, onChange, selected }: Props) {
  const bar = attrs.bar;
  const rows = bar.rows;
  const editable = !attrs.locked && !attrs.presentation;

  const scale = useMemo(
    () => resolveYScale(rows.map((r) => r.value), attrs.yAuto, attrs.yMin, attrs.yMax, attrs.yStep),
    [rows, attrs.yAuto, attrs.yMin, attrs.yMax, attrs.yStep],
  );

  const yToPx = useCallback(
    (v: number) => PAD.top + plotH * (1 - (v - scale.min) / (scale.max - scale.min || 1)),
    [scale.min, scale.max],
  );
  const pxToY = useCallback(
    (px: number) => scale.min + (1 - (px - PAD.top) / plotH) * (scale.max - scale.min),
    [scale.min, scale.max],
  );

  // Bar geometry.
  const n = rows.length;
  const gap = Math.max(0, bar.gap);
  const barWidth = bar.equalWidth
    ? Math.max(4, (plotW - gap * Math.max(0, n - 1)) / Math.max(1, n))
    : bar.barWidth;
  const totalW = n * barWidth + (n - 1) * gap;
  const startX = PAD.left + (plotW - totalW) / 2;
  const xForBar = (i: number) => startX + i * (barWidth + gap);

  const patch = useCallback((p: Partial<SmartChartAttrs>) => onChange(p), [onChange]);
  const patchBar = useCallback(
    (p: Partial<SmartChartAttrs["bar"]>) => patch({ bar: { ...bar, ...p } }),
    [bar, patch],
  );

  const setRow = (i: number, r: Partial<BarRow>) => {
    const next = rows.map((row, idx) => (idx === i ? { ...row, ...r } : row));
    patchBar({ rows: next });
  };
  const addRow = () => {
    const idx = rows.length;
    patchBar({ rows: [...rows, { label: `Item ${idx + 1}`, value: 0 }] });
  };
  const delRow = (i: number) => patchBar({ rows: rows.filter((_, idx) => idx !== i) });

  // Drag a bar top handle to update its value.
  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = (i: number) => (e: React.PointerEvent<SVGElement>) => {
    if (!editable) return;
    e.stopPropagation();
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    const svg = svgRef.current;
    if (!svg) return;
    const onMove = (ev: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const localY = ((ev.clientY - rect.top) / rect.height) * H;
      const v = pxToY(localY);
      const snap = Math.max(1e-6, scale.step / 10);
      const snapped = Math.round(v / snap) * snap;
      const rounded = Number(snapped.toFixed(4));
      setRow(i, { value: Math.max(scale.min, Math.min(scale.max, rounded)) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ── Universal tools helpers ────────────────────────────────────────
  const clearData = () => patchBar({ rows: [] });
  const reset = () => onChange({
    bar: { rows: [], equalWidth: true, gap: 12, barWidth: 40, showValuesAbove: false },
    xLabel: "", yLabel: "", yAuto: true, yMin: null, yMax: null,
    gridlines: true, showAxisLabels: true, showTicks: true,
  });
  const importCSV = (text: string) => {
    const parsed: BarRow[] = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, ...rest] = line.split(/[,\t]/);
        const value = Number(rest.join(",").trim());
        return { label: (label ?? "").trim(), value: Number.isFinite(value) ? value : 0 };
      })
      .filter((r) => r.label !== "" || r.value !== 0);
    patchBar({ rows: parsed });
  };
  const exportCSV = () =>
    ["label,value", ...rows.map((r) => `${JSON.stringify(r.label)},${r.value}`)].join("\n");

  // ── Right-hand Properties Panel content ────────────────────────────
  const editor = (
    <div>
      <PanelGroup label="Data">
        {rows.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">No bars yet — click "Add bar".</div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="mb-1 border-l-2 border-foreground/10 pl-2">
            <PanelRow label={`Bar ${i + 1} label`}>
              <PanelText value={r.label} onChange={(v) => setRow(i, { label: v })} />
            </PanelRow>
            <PanelRow label="Value">
              <PanelNumber value={r.value} step={1} onChange={(v) => setRow(i, { value: v })} />
            </PanelRow>
            <PanelRow label="Colour">
              <PanelColor
                value={r.color ?? attrs.palette[i % attrs.palette.length] ?? DEFAULT_PALETTE[0]}
                onChange={(v) => setRow(i, { color: v })}
              />
            </PanelRow>
            {!bar.equalWidth && (
              <PanelRow label="Bar width">
                <PanelNumber value={r.width ?? bar.barWidth} min={4} max={200}
                  onChange={(v) => setRow(i, { width: v })} />
              </PanelRow>
            )}
            <PanelRow label="Remove">
              <PanelButton onClick={() => delRow(i)}><Minus className="h-3 w-3" /></PanelButton>
            </PanelRow>
          </div>
        ))}
        <PanelRow label="Add bar">
          <PanelButton onClick={addRow}><Plus className="h-3 w-3" /></PanelButton>
        </PanelRow>
      </PanelGroup>

      <PanelGroup label="Axes">
        <PanelRow label="X-axis title"><PanelText value={attrs.xLabel} onChange={(v) => patch({ xLabel: v })} /></PanelRow>
        <PanelRow label="Y-axis title"><PanelText value={attrs.yLabel} onChange={(v) => patch({ yLabel: v })} /></PanelRow>
        <PanelRow label="Show axis labels"><PanelToggle value={attrs.showAxisLabels} onChange={(v) => patch({ showAxisLabels: v })} /></PanelRow>
        <PanelRow label="Show tick marks"><PanelToggle value={attrs.showTicks} onChange={(v) => patch({ showTicks: v })} /></PanelRow>
        <PanelRow label="Show values above bars"><PanelToggle value={bar.showValuesAbove} onChange={(v) => patchBar({ showValuesAbove: v })} /></PanelRow>
        <PanelRow label="Auto-scale Y"><PanelToggle value={attrs.yAuto} onChange={(v) => patch({ yAuto: v })} /></PanelRow>
        {!attrs.yAuto && (
          <>
            <PanelRow label="Y minimum">
              <PanelNumber value={attrs.yMin ?? 0} onChange={(v) => patch({ yMin: v })} />
            </PanelRow>
            <PanelRow label="Y maximum">
              <PanelNumber value={attrs.yMax ?? 10} onChange={(v) => patch({ yMax: v })} />
            </PanelRow>
          </>
        )}
      </PanelGroup>

      <PanelGroup label="Appearance">
        <PanelRow label="Equal bar width"><PanelToggle value={bar.equalWidth} onChange={(v) => patchBar({ equalWidth: v })} /></PanelRow>
        {bar.equalWidth && (
          <PanelRow label="Bar width">
            <PanelNumber value={bar.barWidth} min={4} max={200} onChange={(v) => patchBar({ barWidth: v })} />
          </PanelRow>
        )}
        <PanelRow label="Gap between bars">
          <PanelNumber value={bar.gap} min={0} max={80} onChange={(v) => patchBar({ gap: v })} />
        </PanelRow>
        <PanelRow label="Border thickness">
          <PanelNumber value={attrs.strokeWidth} min={0} max={6} step={0.5} onChange={(v) => patch({ strokeWidth: v })} />
        </PanelRow>
        <PanelRow label="Gridlines"><PanelToggle value={attrs.gridlines} onChange={(v) => patch({ gridlines: v })} /></PanelRow>
      </PanelGroup>

      <UniversalTools
        attrs={attrs}
        onPatch={patch}
        onClearData={clearData}
        onReset={reset}
        onImportCSV={importCSV}
        onExportCSV={exportCSV}
      />
    </div>
  );

  useRegisterAssetEditor(!!selected, "smartChart-bar", "Bar chart", editor);

  // ── SVG render ─────────────────────────────────────────────────────
  const axisColor = "#0f172a";
  return (
    <div className="inline-block max-w-full" style={{ width: "100%", minWidth: 320 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", width: "100%", height: "auto", color: axisColor, userSelect: "none" }}
      >
        {/* gridlines */}
        {attrs.gridlines && scale.ticks.map((t, i) => (
          <line key={`g${i}`} x1={PAD.left} x2={W - PAD.right} y1={yToPx(t)} y2={yToPx(t)}
            stroke={axisColor} strokeOpacity={0.12} />
        ))}

        {/* axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
          stroke={axisColor} strokeWidth={1.5} />
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
          stroke={axisColor} strokeWidth={1.5} />

        {/* y ticks + labels */}
        {scale.ticks.map((t, i) => (
          <g key={`t${i}`}>
            {attrs.showTicks && (
              <line x1={PAD.left - 4} x2={PAD.left} y1={yToPx(t)} y2={yToPx(t)}
                stroke={axisColor} strokeWidth={1} />
            )}
            {attrs.showAxisLabels && (
              <text x={PAD.left - 8} y={yToPx(t)} dy="0.32em" textAnchor="end"
                fontSize={12} fill={axisColor}>{formatTick(t)}</text>
            )}
          </g>
        ))}

        {/* bars */}
        {rows.map((r, i) => {
          const bx = xForBar(i);
          const w = bar.equalWidth ? barWidth : (r.width ?? bar.barWidth);
          const yTop = yToPx(Math.max(0, r.value));
          const yBase = yToPx(0);
          const h = Math.abs(yBase - yTop);
          const color = r.color ?? attrs.palette[i % attrs.palette.length] ?? DEFAULT_PALETTE[0];
          return (
            <g key={i}>
              <rect x={bx} y={Math.min(yTop, yBase)} width={w} height={h}
                fill={color} fillOpacity={0.85}
                stroke={axisColor} strokeWidth={attrs.strokeWidth} />
              {attrs.showAxisLabels && (
                <text x={bx + w / 2} y={H - PAD.bottom + 16} textAnchor="middle"
                  fontSize={12} fill={axisColor}>{r.label}</text>
              )}
              {bar.showValuesAbove && attrs.showAnswers && (
                <text x={bx + w / 2} y={yTop - 6} textAnchor="middle"
                  fontSize={12} fill={axisColor}>{formatTick(r.value)}</text>
              )}
              {editable && (
                <rect
                  x={bx - 3} y={yTop - 6} width={w + 6} height={12}
                  fill="#2563eb" fillOpacity={0.001}
                  stroke="#2563eb" strokeOpacity={0.6} strokeDasharray="3 3"
                  style={{ cursor: "ns-resize" }}
                  onPointerDown={startDrag(i)}
                />
              )}
            </g>
          );
        })}

        {/* axis titles */}
        {attrs.xLabel && (
          <text x={PAD.left + plotW / 2} y={H - 8} textAnchor="middle"
            fontSize={13} fontWeight={600} fill={axisColor}>{attrs.xLabel}</text>
        )}
        {attrs.yLabel && (
          <text x={14} y={PAD.top + plotH / 2}
            transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}
            textAnchor="middle" fontSize={13} fontWeight={600} fill={axisColor}>{attrs.yLabel}</text>
        )}
      </svg>
    </div>
  );
}

function formatTick(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1000) return v.toLocaleString();
  if (Math.round(v) === v) return String(v);
  return v.toFixed(1);
}
