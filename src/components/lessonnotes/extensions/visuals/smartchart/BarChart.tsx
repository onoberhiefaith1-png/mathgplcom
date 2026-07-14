// Mathematical Bar/Histogram renderer. Teachers define scale, categories,
// and values in the right-hand Properties Panel; the software plots the
// bars automatically. Histogram = same renderer with gap forced to 0.

import { useCallback, useMemo } from "react";
import { Minus, Plus, ArrowUp, ArrowDown, Copy as CopyIcon } from "lucide-react";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelColor, PanelToggle, PanelText,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import type { SmartChartAttrs, BarRow, DisplayMode, LabelPos, NumberSide, LegendPos, PresetName } from "./types";
import { DEFAULT_PALETTE } from "./types";
import { resolveYScale, minorTicks, resolveManualScale } from "./scale";
import { UniversalTools } from "./UniversalTools";

interface Props {
  attrs: SmartChartAttrs;
  onChange: (patch: Partial<SmartChartAttrs>) => void;
  selected: boolean;
}

const DEFAULT_W = 520;
const DEFAULT_H = 340;
const PAD = { top: 32, right: 32, bottom: 64, left: 64 };

export function BarChart({ attrs, onChange, selected }: Props) {
  const bar = attrs.bar;
  const rows = bar.rows;
  const isHistogram = attrs.displayMode === "histogram" || attrs.kind === "histogram";

  const W = attrs.canvasWidth;
  const H = attrs.canvasHeight;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const scale = useMemo(
    () => attrs.yScale.mode === "manual"
      ? resolveManualScale(attrs.yScale)
      : resolveYScale(rows.map((r) => r.value), true, null, null, null),
    [rows, attrs.yScale],
  );
  const minor = useMemo(() => minorTicks(scale, attrs.yMinorDivisions), [scale, attrs.yMinorDivisions]);

  const yToPx = useCallback(
    (v: number) => PAD.top + plotH * (1 - (v - scale.min) / (scale.max - scale.min || 1)),
    [scale.min, scale.max],
  );

  // Bar geometry: width is a % of plot width, gap = width in Bar mode, 0 in Histogram.
  const n = rows.length;
  const barWidthPct = Math.max(0.5, Math.min(50, attrs.barWidthPct));
  const barWidth = (plotW * barWidthPct) / 100;
  const gap = isHistogram ? 0 : barWidth;
  const slot = barWidth + gap;
  // Leading gap between Y-axis and the first bar = bar width (bar + histogram).
  const startX = PAD.left + barWidth;
  const xForBar = (i: number) => startX + i * slot;

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
    patchBar({ rows: [...rows, { label: String.fromCharCode(65 + (idx % 26)), value: 0 }] });
  };
  const delRow = (i: number) => patchBar({ rows: rows.filter((_, idx) => idx !== i) });
  const dupRow = (i: number) => {
    const r = rows[i]; if (!r) return;
    patchBar({ rows: [...rows.slice(0, i + 1), { ...r }, ...rows.slice(i + 1)] });
  };
  const moveRow = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    patchBar({ rows: next });
  };

  // Universal tool helpers
  const clearData = () => patchBar({ rows: [] });
  const reset = () => onChange({
    bar: { rows: [], equalWidth: true, gap: 12, barWidth: 40, showValuesAbove: false },
    xLabel: "", yLabel: "",
    barWidthPct: 10,
    canvasWidth: DEFAULT_W,
    canvasHeight: DEFAULT_H,
    yScale: { mode: "manual", cmPerStep: 1, unitPerStep: 1, min: 0, max: 10 },
    yMinorDivisions: 5,
    displayMode: attrs.kind === "histogram" ? "histogram" : "bar",
  });
  const importCSV = (text: string) => {
    const parsed: BarRow[] = text
      .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
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

  // Preset bundles
  const applyPreset = (name: PresetName) => {
    const common = { preset: name } as Partial<SmartChartAttrs>;
    if (name === "waec" || name === "neco") {
      patch({
        ...common,
        grid: { showMajor: true, showMinor: true, color: "#94a3b8", thickness: 1 },
        ticks: { show: true, length: 5, thickness: 1 },
        numbers: { show: true, fontSize: 12, decimals: 0, side: "left" },
        fonts: { family: "Georgia, serif", size: 12, bold: false, italic: false },
        barStyle: { ...attrs.barStyle, borderColor: "#0f172a", borderThickness: 1.5, uniformColor: "#ec4899" },
      });
    } else if (name === "gcse") {
      patch({
        ...common,
        grid: { showMajor: true, showMinor: true, color: "#cbd5e1", thickness: 1 },
        ticks: { show: true, length: 4, thickness: 1 },
        numbers: { show: true, fontSize: 12, decimals: 0, side: "left" },
        fonts: { family: "system-ui, sans-serif", size: 12, bold: false, italic: false },
        barStyle: { ...attrs.barStyle, borderColor: "#0f172a", borderThickness: 1.2, uniformColor: null },
      });
    } else if (name === "alevel") {
      patch({
        ...common,
        grid: { showMajor: true, showMinor: false, color: "#cbd5e1", thickness: 1 },
        ticks: { show: true, length: 5, thickness: 1.2 },
        numbers: { show: true, fontSize: 12, decimals: 1, side: "left" },
        fonts: { family: "system-ui, sans-serif", size: 12, bold: false, italic: false },
      });
    } else {
      patch(common);
    }
  };

  // ── Panel content ─────────────────────────────────────────────────
  const editor = (
    <div>
      {/* 1. Scale — mathematical "cm : unit" graph scale */}
      <PanelGroup label="Scale">
        <PanelRow label="Mode">
          <select
            value={attrs.yScale.mode}
            onChange={(e) => patch({ yScale: { ...attrs.yScale, mode: e.target.value as "auto" | "manual" } })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground"
          >
            <option value="auto">Auto</option>
            <option value="manual">Manual (cm : unit)</option>
          </select>
        </PanelRow>
        {attrs.yScale.mode === "manual" && (
          <>
            <PanelRow label="cm per step">
              <PanelNumber value={attrs.yScale.cmPerStep} min={0.1} step={0.1}
                onChange={(v) => patch({ yScale: { ...attrs.yScale, cmPerStep: Math.max(0.1, v) } })} />
            </PanelRow>
            <PanelRow label="unit per step">
              <PanelNumber value={attrs.yScale.unitPerStep} min={0.001} step={0.1}
                onChange={(v) => patch({ yScale: { ...attrs.yScale, unitPerStep: Math.max(0.001, v) } })} />
            </PanelRow>
            <PanelRow label="Y min">
              <PanelNumber value={attrs.yScale.min}
                onChange={(v) => patch({ yScale: { ...attrs.yScale, min: v } })} />
            </PanelRow>
            <PanelRow label="Y max">
              <PanelNumber value={attrs.yScale.max}
                onChange={(v) => patch({ yScale: { ...attrs.yScale, max: v } })} />
            </PanelRow>
            <div className="px-2 py-1 text-[11px] text-muted-foreground">
              {attrs.yScale.cmPerStep} cm : {attrs.yScale.unitPerStep} unit
            </div>
          </>
        )}
        <PanelRow label="Minor divisions">
          <PanelNumber value={attrs.yMinorDivisions} min={1} max={20}
            onChange={(v) => patch({ yMinorDivisions: Math.max(1, Math.round(v)) })} />
        </PanelRow>
      </PanelGroup>

      {/* 2. Axes */}
      <PanelGroup label="Y-axis">
        <PanelRow label="Title"><PanelText value={attrs.yLabel} onChange={(v) => patch({ yLabel: v })} /></PanelRow>
        <PanelRow label="Show"><PanelToggle value={attrs.yAxis.show} onChange={(v) => patch({ yAxis: { ...attrs.yAxis, show: v } })} /></PanelRow>
        <PanelRow label="Arrow"><PanelToggle value={attrs.yAxis.arrow} onChange={(v) => patch({ yAxis: { ...attrs.yAxis, arrow: v } })} /></PanelRow>
        <PanelRow label="Thickness"><PanelNumber value={attrs.yAxis.thickness} min={0.5} max={6} step={0.5}
          onChange={(v) => patch({ yAxis: { ...attrs.yAxis, thickness: v } })} /></PanelRow>
        <PanelRow label="Colour"><PanelColor value={attrs.yAxis.color}
          onChange={(v) => patch({ yAxis: { ...attrs.yAxis, color: v } })} /></PanelRow>
      </PanelGroup>
      <PanelGroup label="X-axis">
        <PanelRow label="Title"><PanelText value={attrs.xLabel} onChange={(v) => patch({ xLabel: v })} /></PanelRow>
        <PanelRow label="Show"><PanelToggle value={attrs.xAxis.show} onChange={(v) => patch({ xAxis: { ...attrs.xAxis, show: v } })} /></PanelRow>
        <PanelRow label="Arrow"><PanelToggle value={attrs.xAxis.arrow} onChange={(v) => patch({ xAxis: { ...attrs.xAxis, arrow: v } })} /></PanelRow>
        <PanelRow label="Thickness"><PanelNumber value={attrs.xAxis.thickness} min={0.5} max={6} step={0.5}
          onChange={(v) => patch({ xAxis: { ...attrs.xAxis, thickness: v } })} /></PanelRow>
        <PanelRow label="Colour"><PanelColor value={attrs.xAxis.color}
          onChange={(v) => patch({ xAxis: { ...attrs.xAxis, color: v } })} /></PanelRow>
      </PanelGroup>

      {/* 3. Categories + 4. Bars combined per row */}
      <PanelGroup label="Bars (categories & values)">
        {rows.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">No bars yet — click "Add bar".</div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="mb-1 border-l-2 border-foreground/10 pl-2">
            <PanelRow label="Category"><PanelText value={r.label} onChange={(v) => setRow(i, { label: v })} /></PanelRow>
            <PanelRow label="Value"><PanelNumber value={r.value} step={Math.max(0.1, scale.step / 10)}
              onChange={(v) => setRow(i, { value: v })} /></PanelRow>
            <PanelRow label="Colour">
              <PanelColor value={r.color ?? attrs.barStyle.uniformColor ?? attrs.palette[i % attrs.palette.length] ?? DEFAULT_PALETTE[0]}
                onChange={(v) => setRow(i, { color: v })} />
            </PanelRow>
            <PanelRow label="Show label">
              <PanelToggle value={r.showLabel ?? true} onChange={(v) => setRow(i, { showLabel: v })} />
            </PanelRow>
            <PanelRow label="Reorder">
              <PanelButton onClick={() => moveRow(i, -1)}><ArrowUp className="h-3 w-3" /></PanelButton>
              <PanelButton onClick={() => moveRow(i, 1)}><ArrowDown className="h-3 w-3" /></PanelButton>
              <PanelButton onClick={() => dupRow(i)}><CopyIcon className="h-3 w-3" /></PanelButton>
              <PanelButton onClick={() => delRow(i)} variant="danger"><Minus className="h-3 w-3" /></PanelButton>
            </PanelRow>
          </div>
        ))}
        <PanelRow label="Add bar">
          <PanelButton onClick={addRow}><Plus className="h-3 w-3" /></PanelButton>
        </PanelRow>
      </PanelGroup>

      {/* 5. Bar Layout — bar width as % of plot; gap = width (bar) or 0 (histogram) */}
      <PanelGroup label="Bar layout">
        <PanelRow label="Bar width (%)">
          <PanelNumber value={attrs.barWidthPct} min={0.5} max={50} step={0.5}
            onChange={(v) => patch({ barWidthPct: Math.max(0.5, Math.min(50, v)) })} />
        </PanelRow>
        <div className="px-2 py-1 text-[11px] text-muted-foreground">
          {isHistogram
            ? "Histogram: bars touch (gap = 0)."
            : "Bar chart: gap between bars = bar width."}
        </div>
      </PanelGroup>

      {/* 6. Display Mode */}
      <PanelGroup label="Display mode">
        <PanelRow label="Mode">
          <select
            value={attrs.displayMode}
            onChange={(e) => patch({ displayMode: e.target.value as DisplayMode })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground"
          >
            <option value="bar">Bar chart</option>
            <option value="histogram">Histogram</option>
          </select>
        </PanelRow>
      </PanelGroup>

      {/* 7. Grid */}
      <PanelGroup label="Grid">
        <PanelRow label="Major grid"><PanelToggle value={attrs.grid.showMajor}
          onChange={(v) => patch({ grid: { ...attrs.grid, showMajor: v } })} /></PanelRow>
        <PanelRow label="Minor grid"><PanelToggle value={attrs.grid.showMinor}
          onChange={(v) => patch({ grid: { ...attrs.grid, showMinor: v } })} /></PanelRow>
        <PanelRow label="Colour"><PanelColor value={attrs.grid.color}
          onChange={(v) => patch({ grid: { ...attrs.grid, color: v } })} /></PanelRow>
        <PanelRow label="Thickness"><PanelNumber value={attrs.grid.thickness} min={0.25} max={4} step={0.25}
          onChange={(v) => patch({ grid: { ...attrs.grid, thickness: v } })} /></PanelRow>
      </PanelGroup>

      {/* 8. Ticks */}
      <PanelGroup label="Tick marks">
        <PanelRow label="Show"><PanelToggle value={attrs.ticks.show}
          onChange={(v) => patch({ ticks: { ...attrs.ticks, show: v } })} /></PanelRow>
        <PanelRow label="Length"><PanelNumber value={attrs.ticks.length} min={1} max={20}
          onChange={(v) => patch({ ticks: { ...attrs.ticks, length: v } })} /></PanelRow>
        <PanelRow label="Thickness"><PanelNumber value={attrs.ticks.thickness} min={0.25} max={4} step={0.25}
          onChange={(v) => patch({ ticks: { ...attrs.ticks, thickness: v } })} /></PanelRow>
      </PanelGroup>

      {/* 9. Numbers */}
      <PanelGroup label="Scale numbers">
        <PanelRow label="Show"><PanelToggle value={attrs.numbers.show}
          onChange={(v) => patch({ numbers: { ...attrs.numbers, show: v } })} /></PanelRow>
        <PanelRow label="Font size"><PanelNumber value={attrs.numbers.fontSize} min={8} max={32}
          onChange={(v) => patch({ numbers: { ...attrs.numbers, fontSize: v } })} /></PanelRow>
        <PanelRow label="Decimals"><PanelNumber value={attrs.numbers.decimals} min={0} max={6}
          onChange={(v) => patch({ numbers: { ...attrs.numbers, decimals: Math.max(0, Math.round(v)) } })} /></PanelRow>
        <PanelRow label="Side">
          <select value={attrs.numbers.side}
            onChange={(e) => patch({ numbers: { ...attrs.numbers, side: e.target.value as NumberSide } })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground">
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </PanelRow>
      </PanelGroup>

      {/* 10. Data labels */}
      <PanelGroup label="Data labels">
        <PanelRow label="Show values"><PanelToggle value={attrs.dataLabels.show}
          onChange={(v) => patch({ dataLabels: { ...attrs.dataLabels, show: v } })} /></PanelRow>
        <PanelRow label="Position">
          <select value={attrs.dataLabels.position}
            onChange={(e) => patch({ dataLabels: { ...attrs.dataLabels, position: e.target.value as LabelPos } })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground">
            <option value="above">Above bar</option>
            <option value="inside">Inside bar</option>
            <option value="below">Below bar</option>
          </select>
        </PanelRow>
      </PanelGroup>

      {/* 11. Colours */}
      <PanelGroup label="Colours">
        <PanelRow label="Uniform colour">
          <PanelToggle value={attrs.barStyle.uniformColor !== null}
            onChange={(v) => patch({ barStyle: { ...attrs.barStyle, uniformColor: v ? (attrs.barStyle.uniformColor ?? DEFAULT_PALETTE[0]) : null } })} />
        </PanelRow>
        {attrs.barStyle.uniformColor !== null && (
          <PanelRow label="Colour"><PanelColor value={attrs.barStyle.uniformColor}
            onChange={(v) => patch({ barStyle: { ...attrs.barStyle, uniformColor: v } })} /></PanelRow>
        )}
        <PanelRow label="Opacity"><PanelNumber value={attrs.barStyle.opacity} min={0} max={1} step={0.05}
          onChange={(v) => patch({ barStyle: { ...attrs.barStyle, opacity: Math.max(0, Math.min(1, v)) } })} /></PanelRow>
        <PanelRow label="Border colour"><PanelColor value={attrs.barStyle.borderColor}
          onChange={(v) => patch({ barStyle: { ...attrs.barStyle, borderColor: v } })} /></PanelRow>
        <PanelRow label="Border thickness"><PanelNumber value={attrs.barStyle.borderThickness} min={0} max={6} step={0.25}
          onChange={(v) => patch({ barStyle: { ...attrs.barStyle, borderThickness: v } })} /></PanelRow>
      </PanelGroup>

      {/* 12. Fonts */}
      <PanelGroup label="Fonts">
        <PanelRow label="Family">
          <select value={attrs.fonts.family}
            onChange={(e) => patch({ fonts: { ...attrs.fonts, family: e.target.value } })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground">
            <option value="system-ui, sans-serif">Sans-serif</option>
            <option value="Georgia, serif">Serif</option>
            <option value="ui-monospace, monospace">Monospace</option>
          </select>
        </PanelRow>
        <PanelRow label="Size"><PanelNumber value={attrs.fonts.size} min={8} max={32}
          onChange={(v) => patch({ fonts: { ...attrs.fonts, size: v } })} /></PanelRow>
        <PanelRow label="Bold"><PanelToggle value={attrs.fonts.bold}
          onChange={(v) => patch({ fonts: { ...attrs.fonts, bold: v } })} /></PanelRow>
        <PanelRow label="Italic"><PanelToggle value={attrs.fonts.italic}
          onChange={(v) => patch({ fonts: { ...attrs.fonts, italic: v } })} /></PanelRow>
      </PanelGroup>

      {/* 13. Legend */}
      <PanelGroup label="Legend">
        <PanelRow label="Show"><PanelToggle value={attrs.legend.show}
          onChange={(v) => patch({ legend: { ...attrs.legend, show: v } })} /></PanelRow>
        <PanelRow label="Position">
          <select value={attrs.legend.position}
            onChange={(e) => patch({ legend: { ...attrs.legend, position: e.target.value as LegendPos } })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground">
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </PanelRow>
      </PanelGroup>

      {/* 14. Graph area */}
      <PanelGroup label="Graph area">
        <PanelRow label="Background"><PanelColor value={attrs.plotArea.background === "transparent" ? "#ffffff" : attrs.plotArea.background}
          onChange={(v) => patch({ plotArea: { ...attrs.plotArea, background: v } })} /></PanelRow>
        <PanelRow label="Border"><PanelColor value={attrs.plotArea.border === "transparent" ? "#0f172a" : attrs.plotArea.border}
          onChange={(v) => patch({ plotArea: { ...attrs.plotArea, border: v } })} /></PanelRow>
        <PanelRow label="Border thickness"><PanelNumber value={attrs.plotArea.borderThickness} min={0} max={6} step={0.25}
          onChange={(v) => patch({ plotArea: { ...attrs.plotArea, borderThickness: v } })} /></PanelRow>
        <PanelRow label="Padding"><PanelNumber value={attrs.plotArea.padding} min={0} max={40}
          onChange={(v) => patch({ plotArea: { ...attrs.plotArea, padding: v } })} /></PanelRow>
      </PanelGroup>

      {/* 15. Examination mode */}
      <PanelGroup label="Examination mode">
        <PanelRow label="Hide values"><PanelToggle value={attrs.examMode.hideValues}
          onChange={(v) => patch({ examMode: { ...attrs.examMode, hideValues: v } })} /></PanelRow>
        <PanelRow label="Hide category labels"><PanelToggle value={attrs.examMode.hideCategoryLabels}
          onChange={(v) => patch({ examMode: { ...attrs.examMode, hideCategoryLabels: v } })} /></PanelRow>
        <PanelRow label="Hide axis titles"><PanelToggle value={attrs.examMode.hideAxisTitles}
          onChange={(v) => patch({ examMode: { ...attrs.examMode, hideAxisTitles: v } })} /></PanelRow>
        <PanelRow label="Blank graph"><PanelToggle value={attrs.examMode.blank}
          onChange={(v) => patch({ examMode: { ...attrs.examMode, blank: v } })} /></PanelRow>
      </PanelGroup>

      {/* 16. Presets */}
      <PanelGroup label="Presets">
        <PanelRow label="Style">
          <select value={attrs.preset}
            onChange={(e) => applyPreset(e.target.value as PresetName)}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground">
            <option value="custom">Custom</option>
            <option value="waec">WAEC</option>
            <option value="neco">NECO</option>
            <option value="gcse">GCSE</option>
            <option value="alevel">A-Level</option>
          </select>
        </PanelRow>
      </PanelGroup>

      {/* 17. Universal tools */}
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

  useRegisterAssetEditor(
    !!selected,
    "smartChart-bar",
    isHistogram ? "Histogram" : "Bar chart",
    editor,
  );

  // ── SVG render ─────────────────────────────────────────────────────
  const exam = attrs.examMode;
  const blank = exam.blank;
  const showCategoryLabels = attrs.showAxisLabels && !exam.hideCategoryLabels && !blank;
  const showAxisTitles = !exam.hideAxisTitles && !blank;
  const showValueLabels = attrs.dataLabels.show && !exam.hideValues && !blank && attrs.showAnswers;
  const fontStyle: React.CSSProperties = {
    fontFamily: attrs.fonts.family,
    fontWeight: attrs.fonts.bold ? 700 : 400,
    fontStyle: attrs.fonts.italic ? "italic" : "normal",
  };

  const numberX =
    attrs.numbers.side === "right" ? W - PAD.right + 8 : PAD.left - 8;
  const numberAnchor: "start" | "end" =
    attrs.numbers.side === "right" ? "start" : "end";

  const baseline = Math.max(scale.min, Math.min(scale.max, 0));
  const yBaseline = yToPx(baseline);

  const fmt = (v: number) => {
    if (!Number.isFinite(v)) return "";
    return v.toFixed(attrs.numbers.decimals);
  };

  return (
    <div className="inline-block max-w-full" style={{ width: "100%", minWidth: 320 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", width: "100%", height: "auto", userSelect: "none", ...fontStyle }}
      >
        {/* Plot background */}
        <rect
          x={PAD.left - attrs.plotArea.padding}
          y={PAD.top - attrs.plotArea.padding}
          width={plotW + attrs.plotArea.padding * 2}
          height={plotH + attrs.plotArea.padding * 2}
          fill={attrs.plotArea.background}
          stroke={attrs.plotArea.border}
          strokeWidth={attrs.plotArea.borderThickness}
        />

        {/* Minor gridlines (behind major) */}
        {attrs.grid.showMinor && minor.map((t, i) => (
          <line key={`mn${i}`} x1={PAD.left} x2={W - PAD.right} y1={yToPx(t)} y2={yToPx(t)}
            stroke={attrs.grid.color} strokeOpacity={0.15} strokeWidth={attrs.grid.thickness * 0.75} />
        ))}
        {/* Major gridlines */}
        {attrs.grid.showMajor && scale.ticks.map((t, i) => (
          <line key={`mg${i}`} x1={PAD.left} x2={W - PAD.right} y1={yToPx(t)} y2={yToPx(t)}
            stroke={attrs.grid.color} strokeOpacity={0.35} strokeWidth={attrs.grid.thickness} />
        ))}

        {/* Axes */}
        {attrs.yAxis.show && (
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
            stroke={attrs.yAxis.color} strokeWidth={attrs.yAxis.thickness}
            markerEnd={attrs.yAxis.arrow ? "url(#yArrow)" : undefined} />
        )}
        {attrs.xAxis.show && (
          <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
            stroke={attrs.xAxis.color} strokeWidth={attrs.xAxis.thickness}
            markerEnd={attrs.xAxis.arrow ? "url(#xArrow)" : undefined} />
        )}
        <defs>
          <marker id="yArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={attrs.yAxis.color} />
          </marker>
          <marker id="xArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={attrs.xAxis.color} />
          </marker>
        </defs>

        {/* Major tick marks + numbers */}
        {scale.ticks.map((t, i) => (
          <g key={`t${i}`}>
            {attrs.ticks.show && (
              <line x1={PAD.left - attrs.ticks.length} x2={PAD.left}
                y1={yToPx(t)} y2={yToPx(t)}
                stroke={attrs.yAxis.color} strokeWidth={attrs.ticks.thickness} />
            )}
            {attrs.numbers.show && !blank && (
              <text x={numberX} y={yToPx(t)} dy="0.32em" textAnchor={numberAnchor}
                fontSize={attrs.numbers.fontSize} fill={attrs.yAxis.color}>{fmt(t)}</text>
            )}
          </g>
        ))}
        {/* Minor tick marks */}
        {attrs.ticks.show && minor.map((t, i) => (
          <line key={`mt${i}`} x1={PAD.left - attrs.ticks.length * 0.5} x2={PAD.left}
            y1={yToPx(t)} y2={yToPx(t)}
            stroke={attrs.yAxis.color} strokeWidth={attrs.ticks.thickness * 0.75} />
        ))}

        {/* Bars */}
        {!blank && rows.map((r, i) => {
          const bx = xForBar(i);
          const w = barWidth;
          const yTop = yToPx(Math.max(scale.min, Math.min(scale.max, r.value)));
          const h = Math.abs(yBaseline - yTop);
          const color =
            attrs.barStyle.uniformColor ??
            r.color ??
            attrs.palette[i % attrs.palette.length] ??
            DEFAULT_PALETTE[0];
          const labelY =
            attrs.dataLabels.position === "above" ? yTop - 6 :
            attrs.dataLabels.position === "inside" ? (yTop + yBaseline) / 2 :
            yBaseline + 14;
          return (
            <g key={i}>
              <rect x={bx} y={Math.min(yTop, yBaseline)} width={w} height={h}
                fill={color} fillOpacity={attrs.barStyle.opacity}
                stroke={attrs.barStyle.borderColor} strokeWidth={attrs.barStyle.borderThickness} />
              {showCategoryLabels && (r.showLabel ?? true) && (
                <text x={bx + w / 2} y={H - PAD.bottom + 16} textAnchor="middle"
                  fontSize={attrs.fonts.size} fill={attrs.xAxis.color}>{r.label}</text>
              )}
              {showValueLabels && (
                <text x={bx + w / 2} y={labelY} textAnchor="middle" dy="0.32em"
                  fontSize={attrs.fonts.size} fill={attrs.xAxis.color}>{fmt(r.value)}</text>
              )}
            </g>
          );
        })}

        {/* Axis titles */}
        {showAxisTitles && attrs.xLabel && (
          <text x={PAD.left + plotW / 2} y={H - 12} textAnchor="middle"
            fontSize={attrs.fonts.size + 1} fontWeight={700} fill={attrs.xAxis.color}>{attrs.xLabel}</text>
        )}
        {showAxisTitles && attrs.yLabel && (
          <text x={16} y={PAD.top + plotH / 2}
            transform={`rotate(-90 16 ${PAD.top + plotH / 2})`}
            textAnchor="middle" fontSize={attrs.fonts.size + 1} fontWeight={700} fill={attrs.yAxis.color}>{attrs.yLabel}</text>
        )}

        {/* Legend */}
        {attrs.legend.show && !blank && rows.length > 0 && (
          <Legend rows={rows} attrs={attrs} />
        )}
      </svg>
    </div>
  );
}

function Legend({ rows, attrs }: { rows: BarRow[]; attrs: SmartChartAttrs }) {
  const pos = attrs.legend.position;
  const itemW = 90;
  const itemH = 16;
  const cols = pos === "top" || pos === "bottom" ? Math.min(rows.length, 4) : 1;
  const totalCols = Math.max(1, cols);
  const totalRows = Math.ceil(rows.length / totalCols);
  const boxW = totalCols * itemW + 12;
  const boxH = totalRows * itemH + 8;
  let x = W - PAD.right - boxW;
  let y = PAD.top;
  if (pos === "top") { x = PAD.left; y = 4; }
  else if (pos === "bottom") { x = PAD.left; y = H - PAD.bottom + 32; }
  else if (pos === "left") { x = 4; y = PAD.top; }
  return (
    <g>
      <rect x={x} y={y} width={boxW} height={boxH} fill="#fff" fillOpacity={0.85} stroke="#0f172a" strokeOpacity={0.2} />
      {rows.map((r, i) => {
        const c = i % totalCols;
        const rr = Math.floor(i / totalCols);
        const cx = x + 6 + c * itemW;
        const cy = y + 6 + rr * itemH;
        const color = attrs.barStyle.uniformColor ?? r.color ?? attrs.palette[i % attrs.palette.length] ?? DEFAULT_PALETTE[0];
        return (
          <g key={i}>
            <rect x={cx} y={cy} width={10} height={10} fill={color} stroke="#0f172a" strokeOpacity={0.4} />
            <text x={cx + 14} y={cy + 9} fontSize={11} fill="#0f172a">{r.label}</text>
          </g>
        );
      })}
    </g>
  );
}
