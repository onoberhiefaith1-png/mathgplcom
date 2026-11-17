// Fullscreen Smart Table graph: digital Math Lab grid, 3-row XY panel, tool rail.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check, Circle, Eraser, Minus, Spline, TrendingUp, Waypoints, X, GitCommitHorizontal,
} from "lucide-react";
import { graphInk } from "@/lib/graph/graphTheme";
import {
  fitPoints, gridLines, panView, toData, toPx, visibleBounds, zoomAt, zoomFactorFromWheel,
  type DigitalView,
} from "@/lib/graph/digitalView";
import { cn } from "@/lib/utils";
import {
  extractXY, normalizeConnect, scoreTableGraph, type GraphScore, type TableGraphConnect, type XYPoint,
} from "@/lib/lessonnotes/tableGraph";

export type TableGraphScreenProps = {
  headers: string[];
  cells: string[][];
  xCol: number;
  yCol: number;
  graphScore: GraphScore;
  initialPoints?: Array<{ x: number; y: number }>;
  initialConnect?: TableGraphConnect;
  onPointsChange?: (points: Array<{ x: number; y: number }>, connect: TableGraphConnect) => void;
  onClose: () => void;
  /** Optional parser so lesson-note cells can go through cellNumber. */
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
  headers, cells, xCol, yCol, graphScore, initialPoints, initialConnect, onPointsChange, onClose, parseCell,
}: TableGraphScreenProps) {
  const dark = useDark();
  const ink = graphInk(dark ? "darkGreyWhite" : "whiteCharcoal");
  const expected: XYPoint[] = useMemo(
    () => extractXY(cells, xCol, yCol, parseCell),
    [cells, xCol, yCol, parseCell],
  );
  const xLabel = headers[xCol] || "X";
  const yLabel = headers[yCol] || "Y";

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

  const fitted = useMemo(
    () => fitPoints(expected.length ? expected : [{ x: 0, y: 0 }], W, H),
    [expected, W, H],
  );
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

  const [points, setPoints] = useState<Array<{ x: number; y: number }>>(initialPoints ?? []);
  const [connect, setConnect] = useState<TableGraphConnect>(normalizeConnect(initialConnect));
  const [erase, setErase] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof scoreTableGraph> | null>(null);

  const commit = (pts: Array<{ x: number; y: number }>, style: TableGraphConnect) => {
    setPoints(pts);
    setConnect(style);
    setResult(null);
    onPointsChange?.(pts, style);
  };

  const ticks = useMemo(() => gridLines(view, W, H), [view, W, H]);
  const origin = toPx({ x: 0, y: 0 }, view, W, H);
  const pix = points.map((p) => toPx(p, view, W, H));
  const path = buildPath(pix, connect);
  const bounds = visibleBounds(view, W, H);
  void bounds;

  const panRef = useRef<{ x: number; y: number; view: DigitalView; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const plotAt = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    if (erase) {
      let best = -1, bestD = 16;
      pix.forEach((p, i) => {
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) commit(points.filter((_, i) => i !== best), connect);
      return;
    }
    // Snap to 0.1 (the grading tolerance) so table values such as 1, 3, 5 stay reachable
    // even when the visible major step is 2 (minor 0.4).
    const raw = toData(px, py, viewRef.current, W, H);
    const snapped = { x: Math.round(raw.x * 10) / 10, y: Math.round(raw.y * 10) / 10 };
    commit([...points, snapped], connect);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
        const next = zoomAt(viewRef.current, W, H, midX, midY, after / before);
        viewRef.current = next;
        setView(next);
      }
      if (panRef.current) panRef.current.moved = true;
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
      const next = zoomAt(
        viewRef.current, W, H, ev.clientX - r.left, ev.clientY - r.top,
        zoomFactorFromWheel(ev.deltaY, ev.deltaMode),
      );
      viewRef.current = next;
      setView(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [W, H]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const check = () => setResult(scoreTableGraph({ expected, plotted: points, score: graphScore }));

  const pickTool = (id: (typeof TOOLS)[number]["id"]) => {
    if (id === "erase") { setErase(true); return; }
    setErase(false);
    commit(points, id);
  };

  const body = (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Smart Table graph"
      data-table-graph-screen="true"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">
          Graph · {xLabel} vs {yLabel}
        </div>
        {result && (
          <div
            data-graph-score
            className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
            title={result.perPoint.map((p, i) => `Point ${i + 1}: ${p.correct ? p.awarded : 0}/${p.mark}`).join(" · ")}
          >
            {result.label}
          </div>
        )}
        <button
          type="button"
          data-check-graph
          onClick={check}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-primary bg-primary px-2.5 text-xs font-semibold text-primary-foreground"
        >
          <Check className="h-3.5 w-3.5" /> Check Graph
        </button>
        <button
          type="button"
          aria-label="Close graph"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border"
        >
          <X className="h-4 w-4" />
        </button>
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
          {ticks.vertical.filter((l) => l.major && Math.abs(l.world) > 1e-9).map((l, i) => (
            <text key={`tx${i}`} x={l.pos} y={Math.min(H - 2, Math.max(12, origin.y + 12))}
              fontSize="11" textAnchor="middle" fill={ink.text}>{Number(l.world.toPrecision(6))}</text>
          ))}
          {ticks.horizontal.filter((l) => l.major && Math.abs(l.world) > 1e-9).map((l, i) => (
            <text key={`ty${i}`} x={Math.max(4, origin.x - 4)} y={l.pos + 3}
              fontSize="11" textAnchor="end" fill={ink.text}>{Number(l.world.toPrecision(6))}</text>
          ))}
          {path && (
            <path d={path} fill="none" stroke={ink.ink} strokeWidth={2}
              strokeDasharray={connect === "broken" || connect === "segment" ? "8 5" : undefined} />
          )}
          {pix.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={5} fill={ink.ink} data-plotted-point="true" />
          ))}
        </svg>

        {/* 3-row scrollable X/Y values panel, top right (left of the tool rail). */}
        <div
          data-xy-panel
          className="absolute right-14 top-3 z-10 w-[9.5rem] overflow-hidden rounded-md border border-border bg-background/95 text-foreground shadow-md sm:right-16"
        >
          <div className="grid grid-cols-2 border-b border-border bg-muted/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
            <div className="truncate" title={xLabel}>{xLabel}</div>
            <div className="truncate" title={yLabel}>{yLabel}</div>
          </div>
          <div className="max-h-[4.65rem] overflow-y-auto" style={{ maxHeight: "4.65rem" }}>
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

        {/* Right-hand tool rail */}
        <div
          data-graph-tools
          className="absolute bottom-3 right-2 top-3 z-10 flex w-11 flex-col items-center gap-1 rounded-md border border-border bg-background/95 p-1 shadow-md sm:w-12"
        >
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
                  "flex h-9 w-9 items-center justify-center rounded-md border text-foreground",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-transparent hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return body;
  return createPortal(body, document.body);
}

export default TableGraphScreen;
