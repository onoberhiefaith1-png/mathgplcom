import { useEffect, useMemo, useState } from "react";
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Crosshair, Eraser, Maximize2, Menu, Move, Plus, Redo2, RotateCcw,
  Trash2, Undo2, ZoomIn, ZoomOut, Info,
} from "lucide-react";
import Graph2D, { DEFAULT_VIEW, type PlotPath, type View2D } from "@/components/graphApp/Graph2D";
import { clampScale, type PlotBounds } from "@/lib/graphApp/framing";
import { checkGraph, POINT_TOLERANCE, type ConnectStyle, type GradeResult } from "@/lib/graphActivity/grade";
import { DEFAULT_GRAPH_TABLE, extractGraphTable, type GraphTablePoint } from "@/lib/graphActivity/table";
import "./GraphActivity.css";

export type GraphActivityProps = {
  table?: GraphTablePoint[] | null;
  /** Live Report (or any) context — used when `table` is omitted. */
  source?: unknown;
  theme?: "light" | "dark";
  className?: string;
  /** Start with the floating table collapsed (phone default is set from width). */
  startCollapsed?: boolean;
};

type Tool = "point" | "line" | "curve" | "broken" | "scatter" | "eraser" | "pan";
type Snap = { points: GraphTablePoint[]; connect: ConnectStyle };

const PAGE = 3;
const ZOOM = 1.25;

const toolToConnect = (tool: Tool): ConnectStyle | null => {
  if (tool === "line") return "line";
  if (tool === "curve") return "curve";
  if (tool === "broken") return "broken";
  if (tool === "scatter") return "scatter";
  return null;
};

const boundsOf = (points: GraphTablePoint[]): PlotBounds => {
  if (!points.length) return { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const pad = 2;
  return {
    xmin: Math.min(...xs) - pad, xmax: Math.max(...xs) + pad,
    ymin: Math.min(...ys) - pad, ymax: Math.max(...ys) + pad,
  };
};

export default function GraphActivity({ table, source, theme = "light", className, startCollapsed }: GraphActivityProps) {
  const rows = table ?? extractGraphTable(source) ?? DEFAULT_GRAPH_TABLE;
  const [points, setPoints] = useState<GraphTablePoint[]>([]);
  const [connect, setConnect] = useState<ConnectStyle>("none");
  const [tool, setTool] = useState<Tool>("point");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [view, setView] = useState<View2D>(DEFAULT_VIEW);
  const [framing, setFraming] = useState<{ bounds: PlotBounds; revision: number }>(() => ({ bounds: boundsOf(rows), revision: 1 }));
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [page, setPage] = useState(0);
  const [collapsed, setCollapsed] = useState(startCollapsed ?? false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [past, setPast] = useState<Snap[]>([{ points: [], connect: "none" }]);
  const [future, setFuture] = useState<Snap[]>([]);

  useEffect(() => {
    if (startCollapsed != null) return;
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 700px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [startCollapsed]);

  const push = (next: Snap) => {
    setPast((p) => [...p, next]);
    setFuture([]);
    setPoints(next.points);
    setConnect(next.connect);
    setGrade(null);
  };

  const addPoint = (x: number, y: number) => {
    if (tool === "eraser") {
      let best = -1, bestD = Infinity;
      points.forEach((p, i) => {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0 && bestD <= Math.max(0.3, POINT_TOLERANCE * 3)) {
        push({ points: points.filter((_, i) => i !== best), connect });
      }
      return;
    }
    const snapped = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    push({ points: [...points, snapped], connect });
  };

  const chooseTool = (next: Tool) => {
    setTool(next);
    const style = toolToConnect(next);
    if (style) push({ points, connect: style });
    setToolsOpen(false);
  };

  const undo = () => {
    if (past.length <= 1) return;
    const current = past[past.length - 1];
    const prev = past[past.length - 2];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [current, ...f]);
    setPoints(prev.points);
    setConnect(prev.connect);
    setGrade(null);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, next]);
    setPoints(next.points);
    setConnect(next.connect);
    setGrade(null);
  };
  const clear = () => push({ points: [], connect: "none" });

  const zoomBy = (factor: number) => setView((v) => ({ ...v, scale: clampScale(v.scale * factor) }));
  const recentre = () => setFraming({ bounds: boundsOf([...rows, ...points]), revision: framing.revision + 1 });
  const resetView = () => {
    setView(DEFAULT_VIEW);
    setFraming({ bounds: boundsOf(rows), revision: framing.revision + 1 });
  };

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const visible = rows.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const from = rows.length ? safePage * PAGE + 1 : 0;
  const to = Math.min(rows.length, (safePage + 1) * PAGE);

  const marks = useMemo(() => {
    if (!grade) return points.map(() => "plain" as const);
    return points.map((p) => {
      const hit = grade.points.find((g) => g.nearest && g.nearest.x === p.x && g.nearest.y === p.y);
      if (hit?.status === "correct") return "correct" as const;
      if (hit?.status === "swapped") return "swapped" as const;
      return "plain" as const;
    });
  }, [grade, points]);

  const paths: PlotPath[] = [{
    points,
    style: connect === "curve" ? "smooth" : connect === "broken" ? "broken" : connect === "scatter" || connect === "none" ? "scatter" : "straight",
    colour: "hsl(var(--mm-brand, 262 80% 48%))",
    marks,
  }];

  const pointerMode = tool === "pan" ? "pan" : "draw";
  const onCheck = () => setGrade(checkGraph({ table: rows, plotted: points, connect, view, tolerance: POINT_TOLERANCE }));

  const readout = cursor ?? (points.length ? points[points.length - 1] : { x: 0, y: 0 });

  return (
    <section className={`graph-activity ${theme === "dark" ? "ga-dark" : "ga-light"} ${className ?? ""}`} aria-label="Graph Activity" data-theme={theme}>
      <header className="ga-header">
        <strong>Graph Activity</strong>
        <span className="ga-header-actions">
          <button type="button" className="ga-icon-btn" aria-label="About this graph" title={`Plot the table points, then press Check Graph. A point is correct if it is within ${POINT_TOLERANCE} units of the table value.`}>
            <Info size={16} />
          </button>
          <button type="button" className="ga-icon-btn" aria-label="Full screen graph" title="Full screen" onClick={() => {
            const root = document.querySelector(".graph-activity");
            if (!root) return;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void (root as HTMLElement).requestFullscreen?.();
          }}>
            <Maximize2 size={16} />
          </button>
        </span>
      </header>

      <div className="ga-workspace">
        <Graph2D
          items={[]}
          view={view}
          setView={setView}
          grid axes labels
          tool={tool === "eraser" ? "point" : "point"}
          onAddPoint={addPoint}
          framing={framing}
          gridTheme="paper"
          dark={theme === "dark"}
          paths={paths}
          snapDecimals={2}
          hideSensor
          pointerMode={pointerMode}
          onCursor={(c) => setCursor(c ? { x: c.x, y: c.y } : null)}
          className="ga-canvas"
        />

        <nav className="ga-rail" aria-label="Graph tools">
          <button type="button" className={`ga-rail-btn ga-rail-menu ${menuOpen ? "is-on" : ""}`} aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
            <Menu size={16} />
          </button>
          {menuOpen && (
            <div className="ga-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { document.querySelector(".ca-stage")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }}>Back to rankings</button>
              <p>Plot the x and y values from the table, join them, then press Check Graph. Zoom does not change your score.</p>
            </div>
          )}
          <button type="button" className="ga-rail-btn" aria-label="Zoom in" onClick={() => zoomBy(ZOOM)}><ZoomIn size={16} /></button>
          <button type="button" className="ga-rail-btn" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM)}><ZoomOut size={16} /></button>
          <button type="button" className={`ga-rail-btn ${tool === "pan" ? "is-on" : ""}`} aria-label="Pan" aria-pressed={tool === "pan"} onClick={() => setTool("pan")}><Move size={16} /></button>
          <button type="button" className="ga-rail-btn" aria-label="Recentre" onClick={recentre}><Crosshair size={16} /></button>
          <button type="button" className="ga-rail-btn" aria-label="Reset view" onClick={resetView}><RotateCcw size={16} /></button>
        </nav>

        <aside className={`ga-table ${collapsed ? "is-collapsed" : ""}`} aria-label="Smart Table">
          <header>
            <strong>Smart Table</strong>
            <button type="button" aria-label={collapsed ? "Expand table" : "Collapse table"} aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </header>
          {!collapsed && (
            <>
              <table>
                <thead><tr><th scope="col">x</th><th scope="col">y</th></tr></thead>
                <tbody>
                  {visible.map((row, i) => (
                    <tr key={`${row.x},${row.y},${i}`}>
                      <td>{row.x}</td>
                      <td>{row.y}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <footer>
                <span>Rows {from}–{to} of {rows.length}</span>
                <span className="ga-table-nav">
                  <button type="button" aria-label="Previous rows" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft size={14} /></button>
                  <button type="button" aria-label="Next rows" disabled={safePage >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}><ChevronRight size={14} /></button>
                </span>
              </footer>
            </>
          )}
        </aside>

        <div className="ga-plus-wrap">
          {toolsOpen && (
            <div className="ga-tools" role="menu" aria-label="Plotting tools">
              {([
                ["point", "Point"],
                ["line", "Line"],
                ["curve", "Curve"],
                ["broken", "Broken"],
                ["scatter", "Scatter"],
                ["eraser", "Eraser"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" role="menuitem" className={tool === id ? "is-on" : ""} aria-pressed={tool === id} onClick={() => chooseTool(id)}>
                  {id === "eraser" ? <Eraser size={16} /> : id === "point" ? <span className="ga-dot" /> : null}
                  {label}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="ga-plus" aria-label="Open tools" aria-expanded={toolsOpen} onClick={() => setToolsOpen((o) => !o)}>
            <Plus size={22} />
          </button>
        </div>

        <div className="ga-readout" aria-live="polite">(x, y) = ({readout.x.toFixed(2)}, {readout.y.toFixed(2)})</div>
      </div>

      <footer className="ga-bar">
        <button type="button" onClick={clear}><Trash2 size={14} /> Clear</button>
        <button type="button" onClick={undo} disabled={past.length <= 1}><Undo2 size={14} /> Undo</button>
        <button type="button" onClick={redo} disabled={future.length === 0}><Redo2 size={14} /> Redo</button>
        <button type="button" className="ga-check" onClick={onCheck}><Check size={16} /> Check Graph</button>
      </footer>

      {grade && (
        <div className="ga-result" role="status">
          <p>
            <strong>{grade.score.label}</strong>
            {grade.swappedAxes ? " · Swapped axes detected — not marked as correct." : ""}
          </p>
          <ul>
            {grade.points.map((p) => (
              <li key={p.index} data-status={p.status}>
                ({p.expected.x}, {p.expected.y}): {p.status === "correct" ? "correct" : p.status === "swapped" ? "swapped x and y" : "not plotted"}
                {p.distance != null && p.status !== "swapped" ? ` (${p.distance.toFixed(2)} units)` : ""}
              </li>
            ))}
          </ul>
          <p>{grade.connection.detail}</p>
        </div>
      )}
    </section>
  );
}
