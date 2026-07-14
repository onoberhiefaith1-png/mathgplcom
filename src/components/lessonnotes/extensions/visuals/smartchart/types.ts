// Smart Chart data model. One node covers all 8 chart kinds — only the
// payload matching the current `kind` is used. Every field on the top
// level is shared across kinds so panels can be composed from shared
// building blocks (axes, appearance, universal tools).

export type ChartKind =
  | "bar" | "pie" | "histogram" | "scatter"
  | "line" | "dotplot" | "boxplot" | "ogive";

export type DisplayMode = "bar" | "histogram";
export type LabelPos = "above" | "inside" | "below";
export type NumberSide = "left" | "right";
export type LegendPos = "top" | "bottom" | "left" | "right";
export type PresetName = "custom" | "waec" | "neco" | "gcse" | "alevel";

export interface BarRow    { label: string; value: number; color?: string; width?: number; showLabel?: boolean }
export interface PieSector { name: string; value: number; color?: string }
export interface HistInterval { lower: number; upper: number; frequency: number }
export interface ScatterPoint { x: number; y: number }
export interface LinePoint { label: string; value: number }
export interface OgiveRow  { boundary: number; cumFreq: number }

export interface AxisStyle {
  show: boolean;
  arrow: boolean;
  thickness: number;
  color: string;
}
export interface GridStyle {
  showMajor: boolean;
  showMinor: boolean;
  color: string;
  thickness: number;
}
export interface TickStyle { show: boolean; length: number; thickness: number }
export interface NumberStyle { show: boolean; fontSize: number; decimals: number; side: NumberSide }
export interface DataLabelStyle { show: boolean; position: LabelPos }
export interface BarStyle {
  borderColor: string;
  borderThickness: number;
  opacity: number;
  uniformColor: string | null;
}
export interface FontStyle { family: string; size: number; bold: boolean; italic: boolean }
export interface LegendStyle { show: boolean; position: LegendPos }
export interface PlotAreaStyle { background: string; border: string; borderThickness: number; padding: number }
export interface YScale {
  mode: "auto" | "manual";
  cmPerStep: number;   // visual cm per one major step
  unitPerStep: number; // data units per one major step
  min: number;
  max: number;
}
export interface ExamMode {
  hideValues: boolean;
  hideCategoryLabels: boolean;
  hideAxisTitles: boolean;
  blank: boolean;
}

export interface SmartChartAttrs {
  kind: ChartKind;
  title: string;

  // shared appearance
  palette: string[];
  strokeWidth: number;
  gridlines: boolean;

  // classroom controls
  locked: boolean;
  presentation: boolean;
  showAnswers: boolean;
  animateOnChange: boolean;

  // shared axes
  xLabel: string;
  yLabel: string;
  showAxisLabels: boolean;
  showTicks: boolean;
  yAuto: boolean;
  yMin: number | null;
  yMax: number | null;
  yStep: number | null;

  // NEW — mathematical graph controls
  displayMode: DisplayMode;
  yMinorDivisions: number;
  xAxis: AxisStyle;
  yAxis: AxisStyle;
  grid: GridStyle;
  ticks: TickStyle;
  numbers: NumberStyle;
  dataLabels: DataLabelStyle;
  barStyle: BarStyle;
  fonts: FontStyle;
  legend: LegendStyle;
  plotArea: PlotAreaStyle;
  examMode: ExamMode;
  preset: PresetName;

  // Bar width as a percentage of the plot area width (default 10 %).
  barWidthPct: number;
  // Structured graph-style scale (Auto or Manual "cm : unit").
  yScale: YScale;

  // per-kind payload
  bar: {
    rows: BarRow[];
    equalWidth: boolean;
    gap: number;
    barWidth: number;
    showValuesAbove: boolean;
  };
  pie?: {
    sectors: PieSector[];
    labelPos: "inside" | "outside" | "none";
    showPercent: boolean;
    showAngle: boolean;
  };
  histogram?: {
    intervals: HistInterval[];
    useDensity: boolean;
    continuous: boolean;
    gap: number;
  };
  scatter?: {
    points: ScatterPoint[];
    shape: "circle" | "square" | "triangle" | "cross";
    size: number;
    bestFit: "none" | "linear" | "quadratic";
    showEquation: boolean;
    showCorrelation: boolean;
  };
  line?: {
    points: LinePoint[];
    connect: "straight" | "smooth" | "none";
    markerShape: "circle" | "square" | "triangle";
    markerSize: number;
  };
  dotplot?: {
    values: number[];
    dotSize: number;
    shape: "circle" | "square" | "cross";
  };
  boxplot?: {
    min: number; q1: number; median: number; q3: number; max: number;
    outliers: number[];
    showMean: boolean; mean: number | null;
    orientation: "horizontal" | "vertical";
    showLabels: boolean;
  };
  ogive?: {
    rows: OgiveRow[];
    curve: "smooth" | "straight";
    markerShape: "circle" | "square" | "triangle";
    markerSize: number;
  };
}

export const DEFAULT_PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706",
  "#7c3aed", "#0891b2", "#db2777", "#65a30d",
];

const AXIS_DEFAULT: AxisStyle = { show: true, arrow: false, thickness: 1.5, color: "#0f172a" };
const GRID_DEFAULT: GridStyle = { showMajor: true, showMinor: true, color: "#0f172a", thickness: 1 };
const TICKS_DEFAULT: TickStyle = { show: true, length: 4, thickness: 1 };
const NUMBERS_DEFAULT: NumberStyle = { show: true, fontSize: 12, decimals: 0, side: "left" };
const DATALABELS_DEFAULT: DataLabelStyle = { show: false, position: "above" };
const BARSTYLE_DEFAULT: BarStyle = { borderColor: "#0f172a", borderThickness: 1.5, opacity: 0.85, uniformColor: null };
const FONTS_DEFAULT: FontStyle = { family: "system-ui, sans-serif", size: 12, bold: false, italic: false };
const LEGEND_DEFAULT: LegendStyle = { show: false, position: "bottom" };
const PLOTAREA_DEFAULT: PlotAreaStyle = { background: "transparent", border: "transparent", borderThickness: 0, padding: 0 };
const EXAM_DEFAULT: ExamMode = { hideValues: false, hideCategoryLabels: false, hideAxisTitles: false, blank: false };

/** Merge unknown incoming attrs with sane defaults for the requested kind. */
export function normalizeChart(a: Record<string, unknown>): SmartChartAttrs {
  const kind = (["bar","pie","histogram","scatter","line","dotplot","boxplot","ogive"]
    .includes(String(a.kind)) ? a.kind : "bar") as ChartKind;

  const num = (v: unknown, d: number) => Number.isFinite(Number(v)) ? Number(v) : d;
  const bool = (v: unknown, d: boolean) => typeof v === "boolean" ? v : d;
  const str = (v: unknown, d: string) => typeof v === "string" ? v : d;
  const arr = <T,>(v: unknown, d: T[]) => Array.isArray(v) ? (v as T[]) : d;
  const mergeObj = <T extends object>(v: unknown, d: T): T =>
    (v && typeof v === "object") ? { ...d, ...(v as T) } : d;

  const bar = (a.bar as SmartChartAttrs["bar"] | undefined) ?? undefined;
  const barRowsSrc = bar?.rows;
  const barRows: BarRow[] = Array.isArray(barRowsSrc)
    ? barRowsSrc.map((r) => ({
        label: str((r as BarRow)?.label, ""),
        value: num((r as BarRow)?.value, 0),
        color: typeof (r as BarRow)?.color === "string" ? (r as BarRow).color : undefined,
        width: Number.isFinite(Number((r as BarRow)?.width)) ? Number((r as BarRow).width) : undefined,
        showLabel: typeof (r as BarRow)?.showLabel === "boolean" ? (r as BarRow).showLabel : undefined,
      }))
    : [];

  const displayMode: DisplayMode =
    a.displayMode === "histogram" || kind === "histogram" ? "histogram" : "bar";

  return {
    kind,
    title: str(a.title, ""),
    palette: arr<string>(a.palette, DEFAULT_PALETTE),
    strokeWidth: num(a.strokeWidth, 1.5),
    gridlines: bool(a.gridlines, true),
    locked: bool(a.locked, false),
    presentation: bool(a.presentation, false),
    showAnswers: bool(a.showAnswers, true),
    animateOnChange: bool(a.animateOnChange, false),
    xLabel: str(a.xLabel, ""),
    yLabel: str(a.yLabel, ""),
    showAxisLabels: bool(a.showAxisLabels, true),
    showTicks: bool(a.showTicks, true),
    yAuto: bool(a.yAuto, true),
    yMin: a.yMin === null || a.yMin === undefined ? null : num(a.yMin, 0),
    yMax: a.yMax === null || a.yMax === undefined ? null : num(a.yMax, 10),
    yStep: a.yStep === null || a.yStep === undefined ? null : num(a.yStep, 1),
    displayMode,
    yMinorDivisions: Math.max(1, Math.floor(num(a.yMinorDivisions, 5))),
    xAxis: mergeObj(a.xAxis, AXIS_DEFAULT),
    yAxis: mergeObj(a.yAxis, AXIS_DEFAULT),
    grid: mergeObj(a.grid, GRID_DEFAULT),
    ticks: mergeObj(a.ticks, TICKS_DEFAULT),
    numbers: mergeObj(a.numbers, NUMBERS_DEFAULT),
    dataLabels: mergeObj(a.dataLabels, {
      ...DATALABELS_DEFAULT,
      show: bool(bar?.showValuesAbove, DATALABELS_DEFAULT.show),
    }),
    barStyle: mergeObj(a.barStyle, BARSTYLE_DEFAULT),
    fonts: mergeObj(a.fonts, FONTS_DEFAULT),
    legend: mergeObj(a.legend, LEGEND_DEFAULT),
    plotArea: mergeObj(a.plotArea, PLOTAREA_DEFAULT),
    examMode: mergeObj(a.examMode, EXAM_DEFAULT),
    preset: (["custom","waec","neco","gcse","alevel"].includes(String(a.preset))
      ? a.preset : "custom") as PresetName,
    bar: {
      rows: barRows,
      equalWidth: bool(bar?.equalWidth, true),
      gap: num(bar?.gap, 12),
      barWidth: num(bar?.barWidth, 40),
      showValuesAbove: bool(bar?.showValuesAbove, false),
    },
  };
}
