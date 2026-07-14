// Smart Chart data model. One node covers all 8 chart kinds — only the
// payload matching the current `kind` is used. Every field on the top
// level is shared across kinds so panels can be composed from shared
// building blocks (axes, appearance, universal tools).

export type ChartKind =
  | "bar" | "pie" | "histogram" | "scatter"
  | "line" | "dotplot" | "boxplot" | "ogive";

export interface BarRow    { label: string; value: number; color?: string; width?: number }
export interface PieSector { name: string; value: number; color?: string }
export interface HistInterval { lower: number; upper: number; frequency: number }
export interface ScatterPoint { x: number; y: number }
export interface LinePoint { label: string; value: number }
export interface OgiveRow  { boundary: number; cumFreq: number }

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

  // per-kind payload
  bar: {
    rows: BarRow[];
    equalWidth: boolean;
    gap: number;               // px between bars
    barWidth: number;          // px (used when !equalWidth OR default)
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

/** Merge unknown incoming attrs with sane defaults for the requested kind. */
export function normalizeChart(a: Record<string, unknown>): SmartChartAttrs {
  const kind = (["bar","pie","histogram","scatter","line","dotplot","boxplot","ogive"]
    .includes(String(a.kind)) ? a.kind : "bar") as ChartKind;

  const num = (v: unknown, d: number) => Number.isFinite(Number(v)) ? Number(v) : d;
  const bool = (v: unknown, d: boolean) => typeof v === "boolean" ? v : d;
  const str = (v: unknown, d: string) => typeof v === "string" ? v : d;
  const arr = <T,>(v: unknown, d: T[]) => Array.isArray(v) ? (v as T[]) : d;

  const bar = (a.bar as SmartChartAttrs["bar"] | undefined) ?? undefined;
  const barRowsSrc = bar?.rows;
  const barRows: BarRow[] = Array.isArray(barRowsSrc)
    ? barRowsSrc.map((r) => ({
        label: str((r as BarRow)?.label, ""),
        value: num((r as BarRow)?.value, 0),
        color: typeof (r as BarRow)?.color === "string" ? (r as BarRow).color : undefined,
      }))
    : [];

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
    bar: {
      rows: barRows,
      equalWidth: bool(bar?.equalWidth, true),
      gap: num(bar?.gap, 12),
      barWidth: num(bar?.barWidth, 40),
      showValuesAbove: bool(bar?.showValuesAbove, false),
    },
  };
}
