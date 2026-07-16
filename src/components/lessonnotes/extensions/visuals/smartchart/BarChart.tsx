// Fixed-graph Bar / Histogram renderer.
//
// Mathematical model (never negotiable):
//   • Graph paper is CONSTANT. Every major line = 1 cm apart. Exactly
//     4 minor lines sit between two majors (0, .2, .4, .6, .8, 1).
//   • SCALE is variable: teacher answers "1 cm = ___ units". Only axis
//     labels change; spacing does not.
//   • EXTEND adds more cm to the Y-axis (structural). Scale unchanged.
//   • ZOOM is purely visual (CSS scale). Nothing mathematical changes.
//
// Bar heights are stored in CENTIMETRES (`heightCm`), not raw units. A bar
// can never exceed `axisMaxCm`; if the teacher needs a taller bar they
// must Extend the graph first.
//
// Everyday editing happens on the chart itself (top +/scale chip, trailing
// + to add bar, per-bar +/- to grow/shrink, click label for menu). The
// full property panel still exists but is collapsed under "Advanced".

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, ArrowUp, ArrowDown, Copy as CopyIcon, ChevronUp, ZoomIn, ZoomOut } from "lucide-react";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelColor, PanelToggle, PanelText,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import type { SmartChartAttrs, BarRow, DisplayMode, LabelPos, NumberSide, LegendPos, PresetName } from "./types";
import { DEFAULT_PALETTE } from "./types";
import { UniversalTools } from "./UniversalTools";

interface Props {
  attrs: SmartChartAttrs;
  onChange: (patch: Partial<SmartChartAttrs>) => void;
  selected: boolean;
}

// --- Graph paper constants (never exposed to teacher) ----------------
const MINOR_PER_MAJOR = 4;      // fifths inside every cm
const CM_PX = 40;               // SVG units per cm before zoom
const PAD = { top: 44, right: 40, bottom: 72, left: 72 };

export function BarChart({ attrs, onChange, selected }: Props) {
  const bar = attrs.bar;
  const rows = bar.rows;
  const isHistogram = attrs.displayMode === "histogram" || attrs.kind === "histogram";

  const unitsPerCm = attrs.unitsPerCm > 0 ? attrs.unitsPerCm : 5;
  const axisMaxCm = Math.max(3, Math.min(60, Math.round(attrs.axisMaxCm || 20)));
  const zoom = Math.max(0.5, Math.min(3, attrs.zoom || 1));

  // Plot geometry in svg units. The SVG is rendered at width: 100% of the
  // notebook column so it always fills the writable width like graph paper.
  // slotSvg is chosen so bars auto-thin as count grows — the viewBox width
  // scales with baseSlotCount, and the browser then fits the whole viewBox
  // into the column. Bars therefore always fill the paper regardless of
  // notebook width, and never appear as a small floating widget.
  const nBars = Math.max(1, rows.length);
  const baseSlotCount = isHistogram ? nBars : (2 * nBars + 1);
  // slotSvg in svg-units. Pick a comfortable per-slot size so the aspect
  // ratio stays sensible for both few and many bars.
  const slotSvg = baseSlotCount <= 12 ? 48 : baseSlotCount <= 24 ? 36 : 28;
  const plotW = slotSvg * baseSlotCount;
  const plotH = axisMaxCm * CM_PX;
  const svgW = PAD.left + plotW + PAD.right;
  const svgH = PAD.top + plotH + PAD.bottom;

  // Bar width mode
  const widthMult = attrs.barWidthMode === "thin" ? 0.5
    : attrs.barWidthMode === "wide" ? 1.5
    : attrs.barWidthMode === "normal" ? 1.0
    : 1.0; // auto ≡ strict gap=width, mult=1
  const barBase = isHistogram ? slotSvg : slotSvg;   // one slot per bar in both models
  const barWidth = Math.min(slotSvg, barBase * widthMult);
  const gap = isHistogram ? 0 : (slotSvg - barWidth); // pack: gap = leftover in slot pair
  // For bar chart we still want gap==barWidth in auto mode. Recompute:
  // In auto: barWidth = slotSvg (which equals gap slot). Every "unit" slot
  // is slotSvg svg-units. Pattern: gap, bar, gap, bar, …, gap. So x_i for
  // bar i (0-indexed) = PAD.left + slotSvg * (2i + 1).
  const xForBar = (i: number) => {
    if (isHistogram) return PAD.left + i * slotSvg;
    // For non-auto width, shrink the bar and centre it inside its "bar slot"
    const innerOffset = (slotSvg - barWidth) / 2;
    return PAD.left + slotSvg * (2 * i + 1) + innerOffset;
  };

  // Helpers
  const cmToY = useCallback(
    (cm: number) => PAD.top + (axisMaxCm - cm) * CM_PX,
    [axisMaxCm],
  );
  const yBaseline = cmToY(0);

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
    const label = idx < 26
      ? `Bar ${String.fromCharCode(65 + idx)}`
      : `Bar ${idx + 1}`;
    patchBar({ rows: [...rows, { label, value: 0, heightCm: 0 }] });
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

  // Bar +/- : grow/shrink by 1 cm (= 1 major graph unit = unitsPerCm data units)
  const [clampBar, setClampBar] = useState<number | null>(null);
  const clampTimer = useRef<number | null>(null);
  const flashClamp = (i: number) => {
    setClampBar(i);
    if (clampTimer.current) window.clearTimeout(clampTimer.current);
    clampTimer.current = window.setTimeout(() => setClampBar(null), 600);
  };
  const growBar = (i: number) => {
    const r = rows[i]; if (!r) return;
    const cur = r.heightCm ?? 0;
    const next = cur + 1;
    if (next > axisMaxCm) { flashClamp(i); return; }
    setRow(i, { heightCm: next, value: next * unitsPerCm });
  };
  const shrinkBar = (i: number) => {
    const r = rows[i]; if (!r) return;
    const cur = r.heightCm ?? 0;
    // Fine-grained: minor grid line = 0.2 cm
    const next = Math.max(0, +(cur - 0.2).toFixed(2));
    setRow(i, { heightCm: next, value: next * unitsPerCm });
  };

  // Extend / scale
  const extendY = (step = 1) => patch({ axisMaxCm: Math.min(60, axisMaxCm + step) });
  const shrinkY = () => {
    // Only shrink if no bar would be truncated.
    const maxUsed = rows.reduce((m, r) => Math.max(m, r.heightCm ?? 0), 0);
    if (axisMaxCm - 1 < Math.max(3, Math.ceil(maxUsed))) return;
    patch({ axisMaxCm: axisMaxCm - 1 });
  };
  const setScale = (v: number) => {
    if (!(v > 0) || !Number.isFinite(v)) return;
    // Update axis labels only — bar heights (in cm) stay the same; values
    // are re-derived so they stay coherent with the new scale.
    const nextRows = rows.map((r) => ({ ...r, value: (r.heightCm ?? 0) * v }));
    patch({ unitsPerCm: v, bar: { ...bar, rows: nextRows } });
  };

  // ── Small on-canvas overlays (React state) ────────────────────────
  const [scaleDraft, setScaleDraft] = useState<string>(String(unitsPerCm));

  const clearData = () => patchBar({ rows: [] });
  const reset = () => onChange({
    bar: { rows: [], equalWidth: true, gap: 12, barWidth: 40, showValuesAbove: false },
    xLabel: "", yLabel: "",
    unitsPerCm: 5,
    axisMaxCm: 7,
    barWidthMode: "auto",
    zoom: 1,
    barWidthPct: 10,
    displayMode: attrs.kind === "histogram" ? "histogram" : "bar",
  });
  const importCSV = (text: string) => {
    const parsed: BarRow[] = text
      .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .map((line) => {
        const [label, ...rest] = line.split(/[,\t]/);
        const value = Number(rest.join(",").trim());
        const v = Number.isFinite(value) ? value : 0;
        return {
          label: (label ?? "").trim(),
          value: v,
          heightCm: Math.max(0, Math.min(axisMaxCm, v / unitsPerCm)),
        };
      })
      .filter((r) => r.label !== "" || r.value !== 0);
    patchBar({ rows: parsed });
  };
  const exportCSV = () =>
    ["label,value", ...rows.map((r) => `${JSON.stringify(r.label)},${r.value}`)].join("\n");

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

  // ── Right-hand Properties Panel (advanced) ────────────────────────
  const editor = (
    <div>
      <PanelGroup label="Chart">
        <PanelRow label="Title"><PanelText value={attrs.title} onChange={(v) => patch({ title: v })} /></PanelRow>
        <PanelRow label="Y-axis title"><PanelText value={attrs.yLabel} onChange={(v) => patch({ yLabel: v })} /></PanelRow>
        <PanelRow label="X-axis title"><PanelText value={attrs.xLabel} onChange={(v) => patch({ xLabel: v })} /></PanelRow>
        <PanelRow label="Scale (1 cm =)">
          <PanelNumber value={unitsPerCm} min={0.001} step={1}
            onChange={(v) => setScale(v)} />
          <span className="text-[11px] text-muted-foreground">units</span>
        </PanelRow>
        <PanelRow label="Axis height (cm)">
          <PanelNumber value={axisMaxCm} min={3} max={60}
            onChange={(v) => patch({ axisMaxCm: Math.max(3, Math.min(60, Math.round(v))) })} />
        </PanelRow>
        <PanelRow label="Bar width">
          <select value={attrs.barWidthMode}
            onChange={(e) => patch({ barWidthMode: e.target.value as "auto"|"thin"|"normal"|"wide" })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground">
            <option value="auto">Automatic</option>
            <option value="thin">Thin</option>
            <option value="normal">Normal</option>
            <option value="wide">Wide</option>
          </select>
        </PanelRow>
        <PanelRow label="Zoom">
          <PanelButton onClick={() => patch({ zoom: Math.max(0.5, +(zoom - 0.1).toFixed(2)) })}><ZoomOut className="h-3 w-3" /></PanelButton>
          <span className="px-1 text-[11px] tabular-nums">{Math.round(zoom * 100)}%</span>
          <PanelButton onClick={() => patch({ zoom: Math.min(3, +(zoom + 0.1).toFixed(2)) })}><ZoomIn className="h-3 w-3" /></PanelButton>
          <PanelButton onClick={() => patch({ zoom: 1 })}>Reset</PanelButton>
        </PanelRow>
        <PanelRow label="Display">
          <select value={attrs.displayMode}
            onChange={(e) => patch({ displayMode: e.target.value as DisplayMode })}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground">
            <option value="bar">Bar chart</option>
            <option value="histogram">Histogram</option>
          </select>
        </PanelRow>
      </PanelGroup>

      <PanelGroup label="Bars">
        {rows.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            Click the “+” at the end of the X-axis to add a bar.
          </div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="mb-1 border-l-2 border-foreground/10 pl-2">
            <PanelRow label="Name"><PanelText value={r.label} onChange={(v) => setRow(i, { label: v })} /></PanelRow>
            <PanelRow label="Height (cm)">
              <PanelNumber value={r.heightCm ?? 0} min={0} max={axisMaxCm} step={0.2}
                onChange={(v) => {
                  const clamped = Math.max(0, Math.min(axisMaxCm, v));
                  setRow(i, { heightCm: clamped, value: clamped * unitsPerCm });
                }} />
            </PanelRow>
            <PanelRow label="Value">
              <span className="px-1 text-[11px] tabular-nums text-muted-foreground">
                {((r.heightCm ?? 0) * unitsPerCm).toFixed(attrs.numbers.decimals)}
              </span>
            </PanelRow>
            <PanelRow label="Colour">
              <PanelColor value={r.color ?? attrs.barStyle.uniformColor ?? attrs.palette[i % attrs.palette.length] ?? DEFAULT_PALETTE[0]}
                onChange={(v) => setRow(i, { color: v })} />
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

      <details className="mt-2">
        <summary className="cursor-pointer select-none px-2 py-1 text-xs font-medium text-foreground/70 hover:text-foreground">
          Advanced settings
        </summary>

        <PanelGroup label="Y-axis">
          <PanelRow label="Show"><PanelToggle value={attrs.yAxis.show} onChange={(v) => patch({ yAxis: { ...attrs.yAxis, show: v } })} /></PanelRow>
          <PanelRow label="Arrow"><PanelToggle value={attrs.yAxis.arrow} onChange={(v) => patch({ yAxis: { ...attrs.yAxis, arrow: v } })} /></PanelRow>
          <PanelRow label="Thickness"><PanelNumber value={attrs.yAxis.thickness} min={0.5} max={6} step={0.5}
            onChange={(v) => patch({ yAxis: { ...attrs.yAxis, thickness: v } })} /></PanelRow>
          <PanelRow label="Colour"><PanelColor value={attrs.yAxis.color}
            onChange={(v) => patch({ yAxis: { ...attrs.yAxis, color: v } })} /></PanelRow>
        </PanelGroup>
        <PanelGroup label="X-axis">
          <PanelRow label="Show"><PanelToggle value={attrs.xAxis.show} onChange={(v) => patch({ xAxis: { ...attrs.xAxis, show: v } })} /></PanelRow>
          <PanelRow label="Arrow"><PanelToggle value={attrs.xAxis.arrow} onChange={(v) => patch({ xAxis: { ...attrs.xAxis, arrow: v } })} /></PanelRow>
          <PanelRow label="Thickness"><PanelNumber value={attrs.xAxis.thickness} min={0.5} max={6} step={0.5}
            onChange={(v) => patch({ xAxis: { ...attrs.xAxis, thickness: v } })} /></PanelRow>
          <PanelRow label="Colour"><PanelColor value={attrs.xAxis.color}
            onChange={(v) => patch({ xAxis: { ...attrs.xAxis, color: v } })} /></PanelRow>
        </PanelGroup>

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

        <PanelGroup label="Numbers">
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

        <UniversalTools
          attrs={attrs}
          onPatch={patch}
          onClearData={clearData}
          onReset={reset}
          onImportCSV={importCSV}
          onExportCSV={exportCSV}
        />
      </details>
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

  const numberX = attrs.numbers.side === "right" ? PAD.left + plotW + 8 : PAD.left - 8;
  const numberAnchor: "start" | "end" = attrs.numbers.side === "right" ? "start" : "end";
  const fmt = (v: number) => {
    if (!Number.isFinite(v)) return "";
    return v.toFixed(attrs.numbers.decimals);
  };

  // Major cm tick values (0..axisMaxCm)
  const majorTicks: number[] = [];
  for (let k = 0; k <= axisMaxCm; k++) majorTicks.push(k);
  const minorTicks: number[] = [];
  for (let k = 0; k < axisMaxCm; k++) {
    for (let m = 1; m < MINOR_PER_MAJOR + 1; m++) {
      if (m === MINOR_PER_MAJOR + 1) continue;
      minorTicks.push(k + m / (MINOR_PER_MAJOR + 1));
    }
  }
  // Fix: fifths (4 minor lines) between two majors
  minorTicks.length = 0;
  for (let k = 0; k < axisMaxCm; k++) {
    for (let m = 1; m <= MINOR_PER_MAJOR; m++) {
      minorTicks.push(k + m / (MINOR_PER_MAJOR + 1));
    }
  }

  // The wrapper carries CSS zoom. SVG viewBox is untouched (mathematics
  // unchanged); we just scale the DOM box that displays it.
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div style={{ width: `${100 * zoom}%`, minWidth: "100%", position: "relative" }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "100%", height: "auto", userSelect: "none", ...fontStyle }}
        >
          {/* Plot background */}
          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
            fill={attrs.plotArea.background === "transparent" ? "transparent" : attrs.plotArea.background}
            stroke={attrs.plotArea.border === "transparent" ? "none" : attrs.plotArea.border}
            strokeWidth={attrs.plotArea.borderThickness} />

          {/* Minor gridlines (horizontal + vertical, fixed fifths per cm) */}
          {attrs.grid.showMinor && minorTicks.map((cm, i) => (
            <line key={`hmn${i}`} x1={PAD.left} x2={PAD.left + plotW}
              y1={cmToY(cm)} y2={cmToY(cm)}
              stroke={attrs.grid.color} strokeOpacity={0.15}
              strokeWidth={attrs.grid.thickness * 0.75} />
          ))}
          {/* Major gridlines (every cm) */}
          {attrs.grid.showMajor && majorTicks.map((cm, i) => (
            <line key={`hmg${i}`} x1={PAD.left} x2={PAD.left + plotW}
              y1={cmToY(cm)} y2={cmToY(cm)}
              stroke={attrs.grid.color} strokeOpacity={0.35}
              strokeWidth={attrs.grid.thickness} />
          ))}

          {/* Axes */}
          {attrs.yAxis.show && (
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={yBaseline}
              stroke={attrs.yAxis.color} strokeWidth={attrs.yAxis.thickness}
              markerEnd={attrs.yAxis.arrow ? "url(#yArrow)" : undefined} />
          )}
          {attrs.xAxis.show && (
            <line x1={PAD.left} y1={yBaseline} x2={PAD.left + plotW} y2={yBaseline}
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

          {/* Major tick marks + y-axis numbers (value = cm * unitsPerCm) */}
          {majorTicks.map((cm, i) => (
            <g key={`t${i}`}>
              {attrs.ticks.show && (
                <line x1={PAD.left - attrs.ticks.length} x2={PAD.left}
                  y1={cmToY(cm)} y2={cmToY(cm)}
                  stroke={attrs.yAxis.color} strokeWidth={attrs.ticks.thickness} />
              )}
              {attrs.numbers.show && !blank && (
                <text x={numberX} y={cmToY(cm)} dy="0.32em" textAnchor={numberAnchor}
                  fontSize={attrs.numbers.fontSize} fill={attrs.yAxis.color}>
                  {fmt(cm * unitsPerCm)}
                </text>
              )}
            </g>
          ))}
          {/* Minor tick marks */}
          {attrs.ticks.show && minorTicks.map((cm, i) => (
            <line key={`mt${i}`} x1={PAD.left - attrs.ticks.length * 0.5} x2={PAD.left}
              y1={cmToY(cm)} y2={cmToY(cm)}
              stroke={attrs.yAxis.color} strokeWidth={attrs.ticks.thickness * 0.75} />
          ))}

          {/* Bars */}
          {!blank && rows.map((r, i) => {
            const bx = xForBar(i);
            const w = barWidth;
            const hcm = Math.max(0, Math.min(axisMaxCm, r.heightCm ?? 0));
            const yTop = cmToY(hcm);
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
            const shaking = clampBar === i;
            return (
              <g key={i} style={shaking ? { animation: "smartchart-shake 0.5s" } : undefined}>
                <rect x={bx} y={Math.min(yTop, yBaseline)} width={w} height={h}
                  fill={color} fillOpacity={attrs.barStyle.opacity}
                  stroke={attrs.barStyle.borderColor} strokeWidth={attrs.barStyle.borderThickness} />
                {showValueLabels && (
                  <text x={bx + w / 2} y={labelY} textAnchor="middle" dy="0.32em"
                    fontSize={attrs.fonts.size} fill={attrs.xAxis.color}>
                    {fmt(hcm * unitsPerCm)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Axis titles */}
          {showAxisTitles && attrs.xLabel && (
            <text x={PAD.left + plotW / 2} y={svgH - 12} textAnchor="middle"
              fontSize={attrs.fonts.size + 1} fontWeight={700} fill={attrs.xAxis.color}>{attrs.xLabel}</text>
          )}
          {showAxisTitles && attrs.yLabel && (
            <text x={16} y={PAD.top + plotH / 2}
              transform={`rotate(-90 16 ${PAD.top + plotH / 2})`}
              textAnchor="middle" fontSize={attrs.fonts.size + 1} fontWeight={700} fill={attrs.yAxis.color}>{attrs.yLabel}</text>
          )}

          {/* Legend */}
          {attrs.legend.show && !blank && rows.length > 0 && (
            <Legend rows={rows} attrs={attrs} svgW={svgW} svgH={svgH} />
          )}

          <style>{`
            @keyframes smartchart-shake {
              10%,90%{ transform: translateX(-1px); }
              20%,80%{ transform: translateX(2px); }
              30%,50%,70%{ transform: translateX(-3px); }
              40%,60%{ transform: translateX(3px); }
            }
          `}</style>
        </svg>

        {/* ─── HTML overlays on top of the SVG (percent-positioned) ─── */}

        {/* Y-axis top: prominent Scale chip + Extend button */}
        <div
          className="absolute flex items-center gap-2"
          style={{
            left: `${(PAD.left / svgW) * 100}%`,
            top: `${(PAD.top / svgH) * 100}%`,
            transform: "translate(-4px, -120%)",
          }}
        >
          {/* Scale chip — always-visible inline input */}
          <div
            className="inline-flex h-8 items-center gap-1.5 rounded-md border-2 border-foreground/40 bg-background px-2 shadow-sm"
            title="Scale: the number of data units represented by 1 centimetre of graph paper"
          >
            <span className="text-[13px] font-semibold text-foreground">1 cm =</span>
            <input
              type="number"
              min={0.001}
              step={1}
              value={scaleDraft}
              onFocus={() => setScaleDraft(String(unitsPerCm))}
              onChange={(e) => setScaleDraft(e.target.value)}
              onBlur={() => {
                const n = Number(scaleDraft);
                if (n > 0 && Number.isFinite(n)) setScale(n);
                else setScaleDraft(String(unitsPerCm));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setScaleDraft(String(unitsPerCm)); (e.target as HTMLInputElement).blur(); }
              }}
              className="w-14 rounded border border-foreground/30 bg-background px-1.5 py-0.5 text-center text-[14px] font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="text-[13px] font-semibold text-foreground">units</span>
          </div>

          {/* Extend button — same visual weight, clearly separate from Zoom */}
          <button
            type="button"
            onClick={(e) => extendY(e.shiftKey ? 5 : 1)}
            title="Add 1 cm of graph paper at the top (Shift-click for 5 cm)"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border-2 border-primary/60 bg-primary/10 px-2.5 text-[13px] font-semibold text-primary shadow-sm hover:bg-primary/15"
          >
            <ChevronUp className="h-4 w-4" />
            <span>Extend</span>
          </button>
          {axisMaxCm > 3 && (
            <button
              type="button"
              onClick={shrinkY}
              title="Remove 1 cm of graph paper from the top"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/25 bg-background text-[15px] font-semibold text-foreground/60 hover:bg-foreground/5"
              aria-label="Shrink graph"
            >
              −
            </button>
          )}
        </div>


        {/* Trailing "+" to add a bar at end of X-axis */}
        <button
          type="button"
          onClick={addRow}
          title="Add bar"
          className="absolute inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-background text-primary shadow-sm hover:bg-primary/5"
          style={{
            left: `${((PAD.left + plotW + 6) / svgW) * 100}%`,
            top: `${(yBaseline / svgH) * 100}%`,
            transform: "translate(0, -50%)",
          }}
        >
          <Plus className="h-3 w-3" />
        </button>

        {/* Per-bar overlays: hover to reveal +/-, click label for menu */}
        {!blank && rows.map((r, i) => {
          const bx = xForBar(i);
          const w = barWidth;
          const hcm = Math.max(0, Math.min(axisMaxCm, r.heightCm ?? 0));
          const yTop = cmToY(hcm);
          const centreX = bx + w / 2;
          return (
            <div
              key={`ov${i}`}
              className="absolute group"
              style={{
                left: `${(centreX / svgW) * 100}%`,
                top: `${(PAD.top / svgH) * 100}%`,
                height: `${(plotH / svgH) * 100}%`,
                width: `${(w / svgW) * 100}%`,
                transform: "translateX(-50%)",
                pointerEvents: "none",
              }}
            >
              {/* + button (above bar top) */}
              <button
                type="button"
                onClick={() => growBar(i)}
                title="Fast increase: +1 cm (major grid line)"
                className="absolute left-1/2 h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-primary/40 bg-background text-primary opacity-0 shadow-sm transition-opacity hover:bg-primary/5 group-hover:opacity-100 flex"
                style={{
                  top: `${((yTop - PAD.top) / plotH) * 100}%`,
                  transform: "translate(-50%, -120%)",
                  pointerEvents: "auto",
                }}
              >
                <Plus className="h-3 w-3" />
              </button>
              {/* − button (just above X-axis inside plot) */}
              {hcm > 0 && (
                <button
                  type="button"
                  onClick={() => shrinkBar(i)}
                  title="Fine decrease: −0.2 cm (minor grid line)"
                  className="absolute left-1/2 h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-foreground/30 bg-background text-foreground/70 opacity-0 shadow-sm transition-opacity hover:bg-foreground/5 group-hover:opacity-100 flex"
                  style={{
                    top: "100%",
                    transform: "translate(-50%, -120%)",
                    pointerEvents: "auto",
                  }}
                >
                  <Minus className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Labels UNDER x-axis with click-to-open menu */}
        {showCategoryLabels && rows.map((r, i) => {
          const bx = xForBar(i);
          const centreX = bx + barWidth / 2;
          // Wrapper spans the full bar slot; label text is clamped to
          // 70% of that width and auto-fits inside.
          const slotPct = (barWidth / svgW) * 100;
          return (
            <BarLabel
              key={`lb${i}`}
              row={r}
              index={i}
              leftPct={(centreX / svgW) * 100}
              topPct={((yBaseline + 6) / svgH) * 100}
              widthPct={slotPct}
              onRename={(v) => setRow(i, { label: v })}
              onDelete={() => delRow(i)}
              onDuplicate={() => dupRow(i)}
              onColor={(c) => setRow(i, { color: c })}
              onLabelColor={(c) => setRow(i, { labelColor: c })}
              onWidthMode={(m) => patch({ barWidthMode: m })}
              onGrow={() => growBar(i)}
              onShrink={() => shrinkBar(i)}
              widthMode={attrs.barWidthMode}
              color={r.color ?? attrs.barStyle.uniformColor ?? attrs.palette[i % attrs.palette.length] ?? DEFAULT_PALETTE[0]}
              labelColor={r.labelColor ?? attrs.xAxis.color ?? "#0f172a"}
              fontSize={attrs.fonts.size}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Per-bar label + popover menu ──────────────────────────────────
// ─── Auto-fit label: single line → shrink font → wrap words ─────────
function AutoFitLabel({
  text, baseFontPx, minFontPx, color,
}: { text: string; baseFontPx: number; minFontPx: number; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ lines: string[]; fontSize: number }>({
    lines: [text], fontSize: baseFontPx,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // 1. Single line at any size in [min, base]
      for (let f = baseFontPx; f >= minFontPx; f -= 0.5) {
        ctx.font = `${f}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        if (ctx.measureText(text).width <= w) {
          setFit({ lines: [text], fontSize: f });
          return;
        }
      }
      // 2. Wrap into words (one word per line) and pick largest fitting size
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        for (let f = baseFontPx; f >= minFontPx; f -= 0.5) {
          ctx.font = `${f}px system-ui, -apple-system, "Segoe UI", sans-serif`;
          if (words.every((wd) => ctx.measureText(wd).width <= w)) {
            setFit({ lines: words, fontSize: f });
            return;
          }
        }
        setFit({ lines: words, fontSize: minFontPx });
        return;
      }
      // 3. Last resort — single word, use min font
      setFit({ lines: [text], fontSize: minFontPx });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, baseFontPx, minFontPx]);

  return (
    <div ref={ref} style={{ width: "100%", textAlign: "center", color, minWidth: 0 }}>
      {fit.lines.map((line, i) => (
        <div key={i} style={{ fontSize: fit.fontSize, lineHeight: 1.15, whiteSpace: "nowrap" }}>
          {line}
        </div>
      ))}
    </div>
  );
}

// ─── Per-bar label + popover menu ──────────────────────────────────
function BarLabel({
  row, index, leftPct, topPct, widthPct, onRename, onDelete, onDuplicate, onColor,
  onLabelColor, onWidthMode, onGrow, onShrink, widthMode, color, labelColor, fontSize,
}: {
  row: BarRow;
  index: number;
  leftPct: number;
  topPct: number;
  widthPct: number;
  onRename: (v: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onColor: (c: string) => void;
  onLabelColor: (c: string) => void;
  onWidthMode: (m: "auto" | "thin" | "normal" | "wide") => void;
  onGrow: () => void;
  onShrink: () => void;
  widthMode: SmartChartAttrs["barWidthMode"];
  color: string;
  labelColor: string;
  fontSize: number;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(row.label);
  const labelText = row.label || `Bar ${index + 1}`;
  return (
    <div
      className="absolute -translate-x-1/2"
      style={{ left: `${leftPct}%`, top: `${topPct}%`, width: `${widthPct}%` }}
    >
      <div className="flex items-start justify-center gap-1">
        {/* − fine decrease */}
        <button
          type="button"
          onClick={onShrink}
          title="Fine decrease: −0.2 cm"
          className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-semibold text-foreground/60 hover:bg-foreground/10"
        >
          −
        </button>
        {/* Label — 70% of the bar width, auto-fits */}
        <div style={{ width: "70%", minWidth: 0 }}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full rounded px-1 py-0.5 hover:bg-foreground/5"
                title="Click for options"
              >
                <AutoFitLabel
                  text={labelText}
                  baseFontPx={fontSize}
                  minFontPx={9}
                  color={labelColor}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" align="center">
              {renaming ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { onRename(draft); setRenaming(false); }
                      else if (e.key === "Escape") setRenaming(false);
                    }}
                    placeholder="Category name"
                    className="flex-1 rounded border border-foreground/30 bg-background px-2 py-1 text-xs text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => { onRename(draft); setRenaming(false); }}
                    className="rounded border border-foreground/20 bg-background px-2 py-1 text-[11px] text-foreground hover:bg-foreground/5"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="grid gap-1 text-xs text-foreground">
                  <button
                    className="rounded px-2 py-1 text-left hover:bg-foreground/5"
                    onClick={() => { setDraft(row.label); setRenaming(true); }}
                  >Rename</button>
                  <button
                    className="rounded px-2 py-1 text-left hover:bg-foreground/5"
                    onClick={onDuplicate}
                  >Duplicate</button>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span>Bar colour</span>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => onColor(e.target.value)}
                      className="h-5 w-8 cursor-pointer rounded border border-foreground/20 bg-transparent"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span>Text colour</span>
                    <input
                      type="color"
                      value={labelColor}
                      onChange={(e) => onLabelColor(e.target.value)}
                      className="h-5 w-8 cursor-pointer rounded border border-foreground/20 bg-transparent"
                    />
                    {(["#000000", "#1e3a8a", "#b91c1c", "#166534"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onLabelColor(c)}
                        title={c}
                        className="h-4 w-4 rounded-full border border-foreground/30"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <div className="px-2 py-1">
                    <div className="mb-1 text-[11px] text-foreground/60">Bar width (all bars)</div>
                    <div className="flex gap-1">
                      {(["thin","normal","wide","auto"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => onWidthMode(m)}
                          className={`rounded border px-1.5 py-0.5 text-[10px] capitalize ${
                            widthMode === m
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-foreground/20 hover:bg-foreground/5"
                          }`}
                        >{m}</button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="rounded px-2 py-1 text-left text-destructive hover:bg-destructive/5"
                    onClick={onDelete}
                  >Delete</button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
        {/* + fast increase — always beside label */}
        <button
          type="button"
          onClick={onGrow}
          title="Fast increase: +1 cm (major grid line)"
          className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-semibold text-primary hover:bg-primary/10"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Legend (unchanged from previous implementation) ───────────────
function Legend({ rows, attrs, svgW, svgH }: { rows: BarRow[]; attrs: SmartChartAttrs; svgW: number; svgH: number }) {
  const pos = attrs.legend.position;
  const itemW = 90;
  const itemH = 16;
  const cols = pos === "top" || pos === "bottom" ? Math.min(rows.length, 4) : 1;
  const totalCols = Math.max(1, cols);
  const totalRows = Math.ceil(rows.length / totalCols);
  const boxW = totalCols * itemW + 12;
  const boxH = totalRows * itemH + 8;
  let x = svgW - PAD.right - boxW;
  let y = PAD.top;
  if (pos === "top") { x = PAD.left; y = 4; }
  else if (pos === "bottom") { x = PAD.left; y = svgH - PAD.bottom + 32; }
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
