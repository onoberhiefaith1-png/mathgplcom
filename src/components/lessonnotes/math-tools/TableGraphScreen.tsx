// Fullscreen Smart Table graph: digital grid, 3-row XY panel, left tool rail, live score.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Circle, Eraser, Minus, Spline, TrendingUp, Waypoints, X, GitCommitHorizontal,
  Undo2, Trash2, ZoomIn, ZoomOut, Maximize2, PenLine,
} from "lucide-react";
import { graphInk } from "@/lib/graph/graphTheme";
import {
  fitPoints, gridLines, panView, toData, toPx, zoomAt, zoomFactorFromWheel,
  zoomStripRects, zoomZone, type DigitalView, type ZoomHighlight,
} from "@/lib/graph/digitalView";
import { cn } from "@/lib/utils";
import {
  PLOT_COLORS, POINT_TOLERANCE, appendPlotPoint, columnHeadingLabel, commitPlotSeries,
  extractXY, flattenPlotPoints, nearestSeriesIndex, normalizeConnect, normalizeGraphScore,
  normalizePlotColor, plotSeriesOf, plotStroke, scoreTableGraph, undoLastPlotPoint,
  type GraphPlot, type GraphScore, type GraphSeries, type TableGraphConnect, type XYPoint,
} from "@/lib/lessonnotes/tableGraph";
import { holdBoardScroll } from "@/lib/lessonnotes/graphOverlay";

export type TableGraphScreenProps = {
  headers: string[];
  cells: string[][];
  xCol: number;
  yCol: number;
  graphScore: GraphScore;
  initialPoints?: Array<{ x: number; y: number }>;
  initialConnect?: TableGraphConnect;
  initialColor?: string;
  initialSeries?: GraphSeries[];
  onPointsChange?: (points: Array<{ x: number; y: number }>, connect: TableGraphConnect, result: ReturnType<typeof scoreTableGraph>, color?: string, series?: GraphSeries[]) => void;
  onClose: () => void;
  parseCell?: (raw: unknown) => number | null;
};

const TOOLS: { id: TableGraphConnect | "erase"; label: string; icon: typeof Circle }[] = [
  { id: "none", label: "Point", icon: Circle },
  { id: "line", label: "Straight line", icon: TrendingUp },
  { id: "segment", label: "Segment", icon: Minus },
  { id: "curve", label: "Curve", icon: Spline },
  { id: "broken", label: "Broken line", icon: Waypoints },
  { id: "scatter", label: "Scatter", icon: GitCommitHorizontal },
  { id: "erase", label: "Eraser", icon: Eraser },
];

function buildPath(pts: { x: number; y: number }[], style: TableGraphConnect): string | null {
  if (pts.length < 2) return null;
  if (style === "none" || style === "scatter") return null;
  if (style === "line") {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  }
  if (style === "curve" && pts.length >= 3) {
    const d: string[] = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      d.push(`C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`);
    }
    return d.join(" ");
  }
  return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}

function useDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function TableGraphScreen({
  headers, cells, xCol, yCol, graphScore, initialPoints, initialConnect, initialColor, initialSeries, onPointsChange, onClose, parseCell,
}: TableGraphScreenProps) {
  const dark = useDark();
  const ink = graphInk(dark ? "darkGreyWhite" : "whiteCharcoal");
  const expected: XYPoint[] = useMemo(
    () => extractXY(cells, xCol, yCol, parseCell),
    [cells, xCol, yCol, parseCell],
  );
  const score = useMemo(() => normalizeGraphScore(graphScore), [graphScore]);
  const xLabel = columnHeadingLabel(headers[xCol], xCol);
  const yLabel = columnHeadingLabel(headers[yCol], yCol);

  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const apply = () => setSize({ w: Math.max(200, el.clientWidth), h: Math.max(160, el.clientHeight) });
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const W = size.w, H = size.h;

  const fitted = useMemo(() => {
    const pts = expected.length ? expected : [{ x: 0, y: 0 }];
    // Always include the origin so it starts on screen (phone, tablet, desktop).
    return fitPoints([...pts, { x: 0, y: 0 }], W, H);
  }, [expected, W, H]);
  const [view, setView] = useState<DigitalView>(fitted);
  const viewRef = useRef(view);
  viewRef.current = view;
  const fittedKey = `${W}x${H}:${expected.map((p) => `${p.x},${p.y}`).join(";")}`;
  const lastFit = useRef("");
  useEffect(() => {
    if (fittedKey !== lastFit.current) {
      lastFit.current = fittedKey;
      setView(fitted);
      viewRef.current = fitted;
    }
  }, [fittedKey, fitted]);

  const [series, setSeries] = useState<GraphSeries[]>(() =>
    plotSeriesOf({
      points: initialPoints ?? [],
      connect: normalizeConnect(initialConnect),
      color: normalizePlotColor(initialColor),
      series: initialSeries,
    }),
  );
  const [connect, setConnect] = useState<TableGraphConnect>(normalizeConnect(initialConnect));
  const [penColor, setPenColor] = useState(() => normalizePlotColor(initialColor));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [plotting, setPlotting] = useState(true);
  const [startNew, setStartNew] = useState(false);
  const [erase, setErase] = useState(false);
  const points = useMemo(() => flattenPlotPoints(series), [series]);
  const result = useMemo(
    () => scoreTableGraph({ expected, plotted: points, score, tolerance: POINT_TOLERANCE }),
    [expected, points, score],
  );

  const emitSeries = (next: GraphSeries[]) => {
    const clean = next.filter((s) => s.points.length > 0);
    setSeries(clean);
    const pts = flattenPlotPoints(clean);
    const last = clean[clean.length - 1];
    const style = last?.connect ?? connect;
    const color = last?.color ?? penColor;
    const scored = scoreTableGraph({ expected, plotted: pts, score, tolerance: POINT_TOLERANCE });
    onPointsChange?.(pts, style, scored, color, clean);
  };

  const pickColor = (raw: string) => {
    const color = normalizePlotColor(raw);
    setPenColor(color);
    if (selectedIndex != null && series[selectedIndex]) {
      emitSeries(series.map((s, i) => (i === selectedIndex ? { ...s, color } : s)));
    } else if (series.length === 0) {
      const scored = scoreTableGraph({ expected, plotted: [], score, tolerance: POINT_TOLERANCE });
      onPointsChange?.([], connect, scored, color, []);
    }
  };

  const togglePlotting = () => {
    if (plotting) {
      const committed = commitPlotSeries({ series, startNew });
      setSeries(committed.series);
      setStartNew(true);
      setPlotting(false);
      setSelectedIndex(null);
    } else {
      setPlotting(true);
    }
  };

  const ticks = useMemo(() => gridLines(view, W, H), [view, W, H]);
  const origin = toPx({ x: 0, y: 0 }, view, W, H);
  const drawn = series.map((s) => ({
    ...s,
    pix: s.points.map((p) => toPx(p, view, W, H)),
  }));

  const panRef = useRef<{ x: number; y: number; view: DigitalView; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastFocus = useRef<{ x: number; y: number } | null>(null);
  const [zoomHighlight, setZoomHighlight] = useState<ZoomHighlight>("none");
  const [zoomHighlightOn, setZoomHighlightOn] = useState(false);
  const highlightTimer = useRef<number | null>(null);

  const flashZoomStrip = (kind: ZoomHighlight) => {
    if (highlightTimer.current != null) window.clearTimeout(highlightTimer.current);
    if (kind === "none") {
      setZoomHighlightOn(false);
      highlightTimer.current = window.setTimeout(() => setZoomHighlight("none"), 350);
      return;
    }
    setZoomHighlight(kind);
    setZoomHighlightOn(true);
    highlightTimer.current = window.setTimeout(() => setZoomHighlightOn(false), 700);
  };
  useEffect(() => () => { if (highlightTimer.current != null) window.clearTimeout(highlightTimer.current); }, []);

  const applyZoom = (px: number, py: number, factor: number, forceBoth = false) => {
    lastFocus.current = { x: px, y: py };
    const zone = forceBoth ? { axis: "both" as const, highlight: "none" as const } : zoomZone(viewRef.current, W, H, px, py);
    const next = zoomAt(viewRef.current, W, H, px, py, factor, zone.axis);
    viewRef.current = next;
    setView(next);
    flashZoomStrip(zone.highlight);
  };

  const plotAt = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    if (erase) {
      let bestS = -1, bestI = -1, bestD = 16;
      drawn.forEach((s, si) => {
        s.pix.forEach((pt, i) => {
          const d = Math.hypot(pt.x - px, pt.y - py);
          if (d < bestD) { bestD = d; bestS = si; bestI = i; }
        });
      });
      if (bestS >= 0) {
        const next = series.map((s, si) =>
          si === bestS ? { ...s, points: s.points.filter((_, i) => i !== bestI) } : s,
        );
        if (selectedIndex === bestS && next[bestS] && next[bestS].points.length === 0) setSelectedIndex(null);
        emitSeries(next);
      }
      return;
    }
    const hit = nearestSeriesIndex(px, py, drawn.map((s) => ({ pix: s.pix, connect: s.connect })));
    if (hit >= 0) {
      setSelectedIndex(hit);
      return;
    }
    if (!plotting) return;
    setSelectedIndex(null);
    const raw = toData(px, py, viewRef.current, W, H);
    const snapped = { x: Math.round(raw.x * 10) / 10, y: Math.round(raw.y * 10) / 10 };
    const draft = appendPlotPoint({ series, startNew }, snapped, connect, penColor);
    setStartNew(draft.startNew);
    emitSeries(draft.series);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const downEl = svgRef.current?.getBoundingClientRect();
    if (downEl) lastFocus.current = { x: e.clientX - downEl.left, y: e.clientY - downEl.top };
    panRef.current = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (pointers.current.size === 2 && pointers.current.has(e.pointerId)) {
      const beforePts = [...pointers.current.values()];
      const before = Math.hypot(beforePts[0].x - beforePts[1].x, beforePts[0].y - beforePts[1].y);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const afterPts = [...pointers.current.values()];
      const after = Math.hypot(afterPts[0].x - afterPts[1].x, afterPts[0].y - afterPts[1].y);
      if (before > 0 && after > 0) {
        const midX = (afterPts[0].x + afterPts[1].x) / 2 - rect.left;
        const midY = (afterPts[0].y + afterPts[1].y) / 2 - rect.top;
        applyZoom(midX, midY, after / before);
      }
      if (panRef.current) panRef.current.moved = true;
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastFocus.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.x;
    const dy = e.clientY - panRef.current.y;
    if (!panRef.current.moved && Math.hypot(dx, dy) <= 12) return;
    panRef.current.moved = true;
    const next = panView(panRef.current.view, dx, dy);
    viewRef.current = next;
    setView(next);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const pan = panRef.current;
    panRef.current = null;
    if (pan && !pan.moved) plotAt(e.clientX, e.clientY);
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      applyZoom(
        ev.clientX - r.left, ev.clientY - r.top,
        zoomFactorFromWheel(ev.deltaY, ev.deltaMode),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [W, H]);

  // Freeze the Smartboard exactly where it is. Close (button or Escape)
  // only dismisses this overlay — it never reloads or unmounts the board.
  useEffect(() => holdBoardScroll(), []);

  const closeGraph = (ev?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    onClose();
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const zoomBy = (factor: number) => {
    const focus = lastFocus.current;
    if (focus) applyZoom(focus.x, focus.y, factor);
    else applyZoom(W / 2, H / 2, factor, true);
  };

  const pickTool = (id: (typeof TOOLS)[number]["id"]) => {
    if (id === "erase") { setErase(true); return; }
    setErase(false);
    setConnect(id);
    const target = selectedIndex ?? (series.length && !startNew ? series.length - 1 : -1);
    if (target >= 0 && series[target]) {
      emitSeries(series.map((s, i) => (i === target ? { ...s, connect: id } : s)));
    }
  };

  const body = (
    <div
      className="fixed inset-0 z-[200] flex min-h-0 overflow-hidden bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Smart Table graph"
      data-table-graph-screen="true"
    >
      {/* Left-hand tool rail — always on screen. Keys never hide: if they
          do not fit (short landscape, safe-area app shell), the key list
          itself scrolls. Close stays pinned at the bottom. */}
      <div
        data-graph-tools
        className="relative z-20 flex h-full min-h-0 w-12 shrink-0 flex-col border-r border-border bg-background/95 pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] sm:w-14"
      >
        <div
          data-graph-tools-scroll
          className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1"
        >
          <button
            type="button"
            title={plotting ? "Plotting on" : "Plotting off"}
            aria-label="Plotting"
            aria-pressed={plotting}
            data-plotting-toggle
            data-plotting={plotting ? "on" : "off"}
            onClick={togglePlotting}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-foreground",
              plotting ? "border-primary bg-primary text-primary-foreground" : "border-transparent hover:bg-muted",
            )}
          >
            <PenLine className="h-4 w-4" />
          </button>
          <div className="h-px w-8 shrink-0 bg-border" />
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = t.id === "erase" ? erase : !erase && connect === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={t.label}
                aria-label={t.label}
                aria-pressed={active}
                data-tool={t.id}
                onClick={() => pickTool(t.id)}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-foreground",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-transparent hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
          <div className="my-1 h-px w-8 shrink-0 bg-border" />
          <button type="button" title="Undo last point" aria-label="Undo" onClick={() => emitSeries(undoLastPlotPoint(series))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" title="Clear points" aria-label="Clear" onClick={() => { setStartNew(false); setSelectedIndex(null); emitSeries([]); }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted">
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(1.25)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" title="Reset view" aria-label="Reset view" onClick={() => { viewRef.current = fitted; setView(fitted); }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-center p-1">
          <button
            type="button"
            title="Close graph"
            aria-label="Close graph"
            data-close-graph
            onClick={closeGraph}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={hostRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          width={W}
          height={H}
          data-table-graph-canvas="true"
          style={{ background: ink.bg, touchAction: "none", display: "block" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {ticks.vertical.map((l, i) => (
            <line key={`v${i}`} x1={l.pos} y1={0} x2={l.pos} y2={H}
              stroke={l.major ? ink.majorGrid : ink.minorGrid} strokeWidth={l.major ? 1 : 0.5} />
          ))}
          {ticks.horizontal.map((l, i) => (
            <line key={`h${i}`} x1={0} y1={l.pos} x2={W} y2={l.pos}
              stroke={l.major ? ink.majorGrid : ink.minorGrid} strokeWidth={l.major ? 1 : 0.5} />
          ))}
          <line x1={0} y1={origin.y} x2={W} y2={origin.y} stroke={ink.axis} strokeWidth={2} />
          <line x1={origin.x} y1={0} x2={origin.x} y2={H} stroke={ink.axis} strokeWidth={2} />
          {zoomHighlight !== "none" && (() => {
            const strips = zoomStripRects(view, W, H);
            const fill = ink.axis;
            const opacity = zoomHighlightOn ? 0.14 : 0;
            const showH = zoomHighlight === "x" || zoomHighlight === "origin";
            const showV = zoomHighlight === "y" || zoomHighlight === "origin";
            return (
              <g data-zoom-strip={zoomHighlight} pointerEvents="none" style={{ transition: "opacity 350ms ease" }} opacity={opacity}>
                {showH && (
                  <rect data-zoom-strip-x x={strips.horizontal.x} y={strips.horizontal.y}
                    width={strips.horizontal.width} height={strips.horizontal.height} fill={fill} />
                )}
                {showV && (
                  <rect data-zoom-strip-y x={strips.vertical.x} y={strips.vertical.y}
                    width={strips.vertical.width} height={strips.vertical.height} fill={fill} />
                )}
              </g>
            );
          })()}
          {ticks.vertical.filter((l) => l.major && Math.abs(l.world) > 1e-9).map((l, i) => (
            <text key={`tx${i}`} x={l.pos} y={Math.min(H - 2, Math.max(12, origin.y + 12))}
              fontSize="11" textAnchor="middle" fill={ink.text}>{Number(l.world.toPrecision(6))}</text>
          ))}
          {ticks.horizontal.filter((l) => l.major && Math.abs(l.world) > 1e-9).map((l, i) => (
            <text key={`ty${i}`} x={Math.max(4, origin.x - 4)} y={l.pos + 3}
              fontSize="11" textAnchor="end" fill={ink.text}>{Number(l.world.toPrecision(6))}</text>
          ))}
          {drawn.map((s, si) => {
            const stroke = plotStroke(s.color, ink.ink);
            const selected = selectedIndex === si;
            const path = buildPath(s.pix, s.connect);
            const offset = drawn.slice(0, si).reduce((n, prev) => n + prev.points.length, 0);
            return (
              <g key={si} data-plot-series={si} data-plot-color={s.color}>
                {path && (
                  <path d={path} fill="none" stroke={stroke} strokeWidth={selected ? 3 : 2}
                    strokeDasharray={s.connect === "broken" || s.connect === "segment" ? "8 5" : undefined}
                    data-plot-color={s.color}
                    data-selected-series={selected ? "true" : "false"} />
                )}
                {s.pix.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r={selected ? 6 : 5}
                    fill={stroke}
                    opacity={result.perPoint[offset + i]?.correct === false ? 0.45 : 1}
                    data-plotted-point="true"
                    data-plot-color={s.color}
                    data-series-index={si} />
                ))}
              </g>
            );
          })}
        </svg>

        {score.enabled && (
          <div
            data-graph-score
            className="absolute left-3 top-3 z-10 rounded-md bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground shadow-md"
          >
            {result.label}
          </div>
        )}

        <div
          className="absolute right-3 top-3 z-10 flex w-[9.5rem] max-h-[calc(100%-1.5rem)] flex-col gap-2 overflow-y-auto overscroll-contain"
          data-graph-right-stack
        >
          <div
            data-xy-panel
            className="right-3 w-full shrink-0 overflow-hidden rounded-md border border-border bg-background/95 text-foreground shadow-md"
          >
            <div className="grid grid-cols-2 border-b border-border bg-muted/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
              <div className="truncate" title={xLabel}>{xLabel}</div>
              <div className="truncate" title={yLabel}>{yLabel}</div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "4.65rem" }}>
              {expected.length === 0 && (
                <div className="px-2 py-2 text-[11px] text-muted-foreground">No numeric pairs</div>
              )}
              {expected.map((p) => (
                <div key={p.row} className="grid grid-cols-2 border-t border-border/60 px-2 py-1 text-[11px] tabular-nums">
                  <div className="truncate">{p.x}</div>
                  <div className="truncate">{p.y}</div>
                </div>
              ))}
            </div>
          </div>
          <div
            data-color-palette
            role="listbox"
            aria-label="Line colour"
            className="shrink-0 rounded-md border border-border bg-background/95 p-1.5 text-foreground shadow-md"
          >
            <div className="grid grid-cols-4 gap-1">
              {PLOT_COLORS.map((c) => {
                const selectedColor = selectedIndex != null ? series[selectedIndex]?.color : undefined;
                const active = (selectedColor ?? penColor) === c;
                const fill = plotStroke(c, ink.ink);
                return (
                  <button
                    key={c}
                    type="button"
                    role="option"
                    title={`Colour ${c}`}
                    aria-label={`Colour ${c}`}
                    aria-selected={active}
                    data-color-swatch={c}
                    onClick={() => pickColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-sm border border-border",
                      active ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "hover:opacity-90",
                    )}
                    style={{ background: fill }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return body;
  return createPortal(body, document.body);
}

export type { GraphPlot };
export default TableGraphScreen;
