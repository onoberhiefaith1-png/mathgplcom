// Smart Graph NodeView — a clean, classroom-friendly graph workspace
// embedded directly in the lesson note.
//
// Design goals (June 2026 refinement):
//   - White surface, dark text, light-grey borders, yellow only for the
//     active tool. Inputs look like plain text boxes.
//   - Manual scale entry. The teacher types whatever comparison they
//     want (e.g. "1 cm = 2 units" or "5 cm = 3 units"). No dropdowns.
//   - Fully movable axes. Drag the X-axis up/down and the Y-axis
//     left/right. Numbering, ticks and labels re-derive automatically
//     from origin position + scale.
//   - Cleaner toolbar: essentials in the top row, advanced settings
//     tucked behind a "More" disclosure.
//   - Spreadsheet-style data table fixed at the top; graph scrolls
//     underneath. Inline undo / redo / clear.

import { useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, Undo2, Redo2, Eraser, ChevronDown, ChevronUp, Move, Sparkles,
} from "lucide-react";
import type { GraphPoint, ConnectStyle, GraphShape, SmartGraphAttrs } from "@/components/lessonnotes/extensions/SmartGraph";
import { cn } from "@/lib/utils";
import { useGeometryMode } from "@/components/lessonnotes/geometry-editor/GeometryModeContext";

const SQ = 28; // pixels per square — kept generous so the grid never feels cramped.

type Mode = "plot" | "moveX" | "moveY";

export function SmartGraphView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as unknown as SmartGraphAttrs;
  const update = (patch: Partial<SmartGraphAttrs>) => updateAttributes(patch as Record<string, unknown>);

  // ---- Local interaction state ---------------------------------------------
  const [mode, setMode] = useState<Mode>("plot");
  const [showMore, setShowMore] = useState(false);
  const [connect, setConnect] = useState<ConnectStyle>(a.connect ?? "straight");
  useEffect(() => { if (a.connect && a.connect !== connect) setConnect(a.connect); }, [a.connect]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Smart Scale assistant ----------------------------------------------
  // Watches the data range + current scale and proposes a better cm-per-unit
  // when the points overflow the page or look cramped. No equation generation,
  // no "Generate" button — the scale fields themselves already update live.
  const scaleSuggestion = useMemo(() => {
    const pts = a.points ?? [];
    if (pts.length === 0) return null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const xMin = Math.min(0, ...xs), xMax = Math.max(0, ...xs);
    const yMin = Math.min(0, ...ys), yMax = Math.max(0, ...ys);
    const xRange = Math.max(1e-6, xMax - xMin);
    const yRange = Math.max(1e-6, yMax - yMin);

    // "Nice" step from a target raw step (1, 2, 5, 10 family).
    const nice = (raw: number) => {
      if (raw <= 0) return 1;
      const pow = Math.pow(10, Math.floor(Math.log10(raw)));
      const f = raw / pow;
      const m = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
      return m * pow;
    };

    // Aim for ~10 squares across the data range on each axis so the graph
    // breathes without leaving the page.
    const targetSquaresX = Math.max(8, Math.min(a.squaresX - 2, 14));
    const targetSquaresY = Math.max(6, Math.min(a.squaresY - 2, 10));
    const sx = nice(xRange / targetSquaresX);
    const sy = nice(yRange / targetSquaresY);

    // What the current scale produces.
    const currentSpanX = a.squaresX * a.unitsPerSquareX;
    const currentSpanY = a.squaresY * a.unitsPerSquareY;
    const overflowX = xRange > currentSpanX * 0.95;
    const overflowY = yRange > currentSpanY * 0.95;
    const crampedX = xRange < currentSpanX * 0.15;
    const crampedY = yRange < currentSpanY * 0.15;

    const changeX = Math.abs(sx - a.unitsPerSquareX) / a.unitsPerSquareX > 0.25;
    const changeY = Math.abs(sy - a.unitsPerSquareY) / a.unitsPerSquareY > 0.25;
    if (!changeX && !changeY) return null;

    let reason: string;
    if (overflowX || overflowY) {
      reason = "Current scale is too small — some plotted points fall off the page.";
    } else if (crampedX || crampedY) {
      reason = "Current scale is too large — the graph looks cramped near the origin.";
    } else {
      reason = "This scale fits all plotted points neatly on the page.";
    }
    return { sx, sy, reason };
  }, [a.points, a.unitsPerSquareX, a.unitsPerSquareY, a.squaresX, a.squaresY]);

  const applyScaleSuggestion = () => {
    if (!scaleSuggestion) return;
    update({ unitsPerSquareX: scaleSuggestion.sx, unitsPerSquareY: scaleSuggestion.sy });
    setScaleXText(`1 cm = ${scaleSuggestion.sx} unit${scaleSuggestion.sx === 1 ? "" : "s"}`);
    setScaleYText(`1 cm = ${scaleSuggestion.sy} unit${scaleSuggestion.sy === 1 ? "" : "s"}`);
  };
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  // A fresh suggestion (different reason/values) un-dismisses itself.
  useEffect(() => { setSuggestionDismissed(false); }, [scaleSuggestion?.sx, scaleSuggestion?.sy, scaleSuggestion?.reason]);



  // ---- Geometry-inside-graph -----------------------------------------------
  // When the document-wide Geometry Mode is active, clicks inside the graph
  // canvas place geometry shapes (point / line / circle / arc / polygon)
  // instead of plotting data points. Shapes are stored on the node attrs.
  const geo = useGeometryMode();
  const geomActive = geo.mode && ["point", "line", "circle", "arc", "polygon"].includes(geo.tool);
  const [geomDraft, setGeomDraft] = useState<Array<{ x: number; y: number }>>([]);
  useEffect(() => { setGeomDraft([]); }, [geo.tool, geo.mode]);

  const setShapes = (shapes: GraphShape[]) => update({ shapes });
  const addShape = (kind: GraphShape["kind"], pts: Array<{ x: number; y: number }>) =>
    setShapes([...(a.shapes ?? []), { id: `s${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind, pts }]);


  // ---- Manual scale entry --------------------------------------------------
  // The teacher writes the comparison freely; we parse "N cm = M units".
  const [scaleXText, setScaleXText] = useState(`1 cm = ${a.unitsPerSquareX} unit${a.unitsPerSquareX === 1 ? "" : "s"}`);
  const [scaleYText, setScaleYText] = useState(`1 cm = ${a.unitsPerSquareY} unit${a.unitsPerSquareY === 1 ? "" : "s"}`);

  const parseScale = (txt: string): number | null => {
    // accept "1 cm = 2 units", "5 cm = 3 units", "1=2", "2", etc.
    const m = txt.match(/(-?\d*\.?\d+)\s*(?:cm)?\s*=\s*(-?\d*\.?\d+)/i);
    if (m) {
      const lhs = Number(m[1]); const rhs = Number(m[2]);
      if (lhs > 0 && Number.isFinite(rhs)) return rhs / lhs;
      return null;
    }
    const n = Number(txt);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const commitScaleX = () => {
    const v = parseScale(scaleXText);
    if (v && v !== a.unitsPerSquareX) update({ unitsPerSquareX: v });
  };
  const commitScaleY = () => {
    const v = parseScale(scaleYText);
    if (v && v !== a.unitsPerSquareY) update({ unitsPerSquareY: v });
  };

  // ---- Undo / Redo (local history of point arrays) -------------------------
  const historyRef = useRef<GraphPoint[][]>([a.points ?? []]);
  const cursorRef = useRef(0);
  const lastPointsRef = useRef<GraphPoint[]>(a.points ?? []);
  useEffect(() => {
    // Track external changes (e.g. table edits) into history.
    if (a.points !== lastPointsRef.current) {
      lastPointsRef.current = a.points;
      historyRef.current = historyRef.current.slice(0, cursorRef.current + 1);
      historyRef.current.push(a.points);
      cursorRef.current = historyRef.current.length - 1;
    }
  }, [a.points]);
  const setPoints = (pts: GraphPoint[]) => { lastPointsRef.current = pts; update({ points: pts }); };
  const undo = () => {
    if (cursorRef.current > 0) {
      cursorRef.current -= 1;
      const pts = historyRef.current[cursorRef.current];
      lastPointsRef.current = pts;
      update({ points: pts });
    }
  };
  const redo = () => {
    if (cursorRef.current < historyRef.current.length - 1) {
      cursorRef.current += 1;
      const pts = historyRef.current[cursorRef.current];
      lastPointsRef.current = pts;
      update({ points: pts });
    }
  };

  // ---- Geometry helpers ----------------------------------------------------
  const W = a.squaresX * SQ;
  const H = a.squaresY * SQ;
  const oxPx = a.originSquareX * SQ;
  const oyPx = a.originSquareY * SQ;

  const toPx = (p: GraphPoint) => ({
    x: oxPx + (p.x / a.unitsPerSquareX) * SQ,
    y: oyPx - (p.y / a.unitsPerSquareY) * SQ,
  });
  const toData = (px: number, py: number): GraphPoint => ({
    x: Math.round(((px - oxPx) / SQ) * a.unitsPerSquareX * 100) / 100,
    y: Math.round(((oyPx - py) / SQ) * a.unitsPerSquareY * 100) / 100,
  });

  // ---- Canvas interactions -------------------------------------------------
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<null | "x" | "y">(null);

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!svgRef.current || draggingRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Geometry-mode interception: build shapes by accumulating clicks.
    if (geomActive) {
      const snap = (v: number) => Math.round((v / SQ) * 2) / 2 * SQ;
      const p = { x: snap(x), y: snap(y) };
      const t = geo.tool as GraphShape["kind"];
      if (t === "point") { addShape("point", [p]); return; }
      if (t === "line") {
        if (geomDraft.length === 0) setGeomDraft([p]);
        else { addShape("line", [geomDraft[0], p]); setGeomDraft([]); }
        return;
      }
      if (t === "circle" || t === "arc") {
        const next = [...geomDraft, p];
        if (next.length < 3) setGeomDraft(next);
        else { addShape(t, next); setGeomDraft([]); }
        return;
      }
      if (t === "polygon") {
        // Click points; double-click to close.
        if (e.detail >= 2 && geomDraft.length >= 2) {
          addShape("polygon", geomDraft);
          setGeomDraft([]);
        } else {
          setGeomDraft([...geomDraft, p]);
        }
        return;
      }
    }
    if (mode !== "plot") return;
    const sx = Math.round((x / SQ) * 2) / 2 * SQ;
    const sy = Math.round((y / SQ) * 2) / 2 * SQ;
    setPoints([...a.points, toData(sx, sy)]);
  };

  const onSvgMouseDown = (e: React.MouseEvent) => {
    if (mode === "moveX") draggingRef.current = "x";
    else if (mode === "moveY") draggingRef.current = "y";
  };
  const onSvgMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (draggingRef.current === "x") {
      const sq = Math.max(0, Math.min(a.squaresY, Math.round((e.clientY - rect.top) / SQ)));
      if (sq !== a.originSquareY) update({ originSquareY: sq });
    } else {
      const sq = Math.max(0, Math.min(a.squaresX, Math.round((e.clientX - rect.left) / SQ)));
      if (sq !== a.originSquareX) update({ originSquareX: sq });
    }
  };
  const endDrag = () => { draggingRef.current = null; };

  // ---- Derived render data -------------------------------------------------
  const path = useMemo(
    () => buildPath(a.points.map(toPx), connect),
    [a.points, connect, oxPx, oyPx, a.unitsPerSquareX, a.unitsPerSquareY], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const xTicks = useMemo(() => Array.from({ length: a.squaresX + 1 }, (_, i) => i), [a.squaresX]);
  const yTicks = useMemo(() => Array.from({ length: a.squaresY + 1 }, (_, i) => i), [a.squaresY]);

  // ---- UI ------------------------------------------------------------------
  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "my-4 rounded-md border bg-white text-neutral-900",
        selected ? "border-yellow-400 shadow-sm" : "border-neutral-200",
      )}
      data-drag-handle
    >
      {/* Essentials toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-neutral-200 bg-white text-[12px]">
        <span className="font-semibold mr-1">Graph</span>

        <ToolButton active={mode === "plot"} onClick={() => setMode("plot")} icon={<Plus className="h-3.5 w-3.5" />} label="Plot" />
        <ToolButton active={mode === "moveX"} onClick={() => setMode("moveX")} icon={<Move className="h-3.5 w-3.5 rotate-90" />} label="Move X" />
        <ToolButton active={mode === "moveY"} onClick={() => setMode("moveY")} icon={<Move className="h-3.5 w-3.5" />} label="Move Y" />

        <span className="mx-1 h-5 w-px bg-neutral-200" />

        {/* Connect picker — segmented buttons, yellow when active */}
        {[
          { v: "straight" as const, label: "Line" },
          { v: "smooth" as const, label: "Curve" },
          { v: "broken" as const, label: "Broken" },
          { v: "scatter" as const, label: "Scatter" },
        ].map((c) => (
          <ToolButton
            key={c.v}
            active={connect === c.v}
            onClick={() => { setConnect(c.v); update({ connect: c.v }); }}
            label={c.label}
          />
        ))}

        <span className="mx-1 h-5 w-px bg-neutral-200" />

        <IconBtn onClick={undo} title="Undo"><Undo2 className="h-3.5 w-3.5" /></IconBtn>
        <IconBtn onClick={redo} title="Redo"><Redo2 className="h-3.5 w-3.5" /></IconBtn>
        <IconBtn onClick={() => setPoints([])} title="Clear graph"><Eraser className="h-3.5 w-3.5" /></IconBtn>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className="h-7 px-2 text-[11px] rounded border border-neutral-200 bg-white hover:bg-neutral-50 inline-flex items-center gap-1"
          >
            More {showMore ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={() => deleteNode()}
            title="Remove graph"
            className="h-7 w-7 inline-flex items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scale row — manual entry, looks like normal text inputs */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-neutral-200 bg-white text-[12px]">
        <span className="text-neutral-500">Scale</span>
        <label className="inline-flex items-center gap-1.5">
          <span className="text-neutral-700">X:</span>
          <Input
            value={scaleXText}
            onChange={(e) => setScaleXText(e.target.value)}
            onBlur={commitScaleX}
            onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
            className="h-7 w-36 text-[12px] bg-white"
            placeholder="1 cm = 2 units"
          />
        </label>
        <label className="inline-flex items-center gap-1.5">
          <span className="text-neutral-700">Y:</span>
          <Input
            value={scaleYText}
            onChange={(e) => setScaleYText(e.target.value)}
            onBlur={commitScaleY}
            onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
            className="h-7 w-36 text-[12px] bg-white"
            placeholder="1 cm = 5 units"
          />
        </label>
        <span className="text-neutral-400 text-[11px]">Tip: select <em>Move X</em> or <em>Move Y</em>, then drag the axis.</span>
      </div>

      {/* Smart Scale — live scale recommendations based on plotted points.
          No equation generation; the AI here is purely a layout assistant. */}
      {scaleSuggestion && !suggestionDismissed && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-neutral-200 bg-yellow-50/50 text-[12px]">
          <Sparkles className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
          <span className="text-neutral-700 font-medium">Smart Scale</span>
          <span className="text-neutral-600">
            Suggested: <strong>1 cm = {scaleSuggestion.sx} unit{scaleSuggestion.sx === 1 ? "" : "s"}</strong> (X),
            <strong> 1 cm = {scaleSuggestion.sy} unit{scaleSuggestion.sy === 1 ? "" : "s"}</strong> (Y).
          </span>
          <span className="text-neutral-500 italic">{scaleSuggestion.reason}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button" size="sm" onClick={applyScaleSuggestion}
              className="h-7 px-3 text-[11px] bg-yellow-300 hover:bg-yellow-400 text-neutral-900 border border-yellow-400"
            >Accept</Button>
            <button
              type="button" onClick={() => setSuggestionDismissed(true)}
              className="h-7 px-2 text-[11px] text-neutral-500 hover:text-neutral-700"
            >Ignore</button>
          </div>
        </div>
      )}
      {geo.mode && (
        <div className="px-3 py-1.5 border-b border-neutral-200 bg-white text-[11px] text-yellow-700">
          Diagram mode: click in graph to draw <strong>{geo.tool}</strong>
          {geomDraft.length > 0 && ` (${geomDraft.length} pt${geomDraft.length === 1 ? "" : "s"})`}
        </div>
      )}



      {/* More — advanced grid + axis settings */}
      {showMore && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-neutral-200 bg-neutral-50 text-[11px]">
          <NumField label="Grid columns" value={a.squaresX} onChange={(v) => update({ squaresX: Math.max(4, v) })} />
          <NumField label="Grid rows" value={a.squaresY} onChange={(v) => update({ squaresY: Math.max(4, v) })} />
          <NumField label="Origin X (sq)" value={a.originSquareX} onChange={(v) => update({ originSquareX: clamp(v, 0, a.squaresX) })} />
          <NumField label="Origin Y (sq)" value={a.originSquareY} onChange={(v) => update({ originSquareY: clamp(v, 0, a.squaresY) })} />
          <label className="inline-flex items-center gap-1.5">
            <span className="text-neutral-600">X label</span>
            <Input value={a.xLabel} onChange={(e) => update({ xLabel: e.target.value })} className="h-7 w-20 text-[11px] bg-white" />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-neutral-600">Y label</span>
            <Input value={a.yLabel} onChange={(e) => update({ yLabel: e.target.value })} className="h-7 w-20 text-[11px] bg-white" />
          </label>
        </div>
      )}

      {/* Sticky spreadsheet-style data table */}
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-10">
        <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-neutral-500 border-b border-neutral-100">Data</div>
        <div className="overflow-x-auto max-h-40">
          <table className="w-full text-[12px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-neutral-50 text-neutral-600">
                <th className="px-2 py-1 text-left font-medium w-10 border-b border-neutral-200">#</th>
                <th className="px-2 py-1 text-left font-medium border-b border-l border-neutral-200">{a.xLabel}</th>
                <th className="px-2 py-1 text-left font-medium border-b border-l border-neutral-200">{a.yLabel}</th>
                <th className="w-8 border-b border-l border-neutral-200" />
              </tr>
            </thead>
            <tbody>
              {a.points.length === 0 && (
                <tr><td colSpan={4} className="px-2 py-2 text-center text-neutral-400 italic">Click in the graph below to plot points.</td></tr>
              )}
              {a.points.map((p, i) => (
                <tr key={i} className="hover:bg-yellow-50/40">
                  <td className="px-2 py-0.5 text-neutral-400 border-b border-neutral-100">{i + 1}</td>
                  <td className="px-1 py-0.5 border-b border-l border-neutral-100">
                    <input
                      type="number" value={p.x}
                      onChange={(e) => setPoints(a.points.map((pp, j) => j === i ? { ...pp, x: Number(e.target.value) } : pp))}
                      className="w-full bg-transparent outline-none focus:bg-yellow-50 px-1"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-b border-l border-neutral-100">
                    <input
                      type="number" value={p.y}
                      onChange={(e) => setPoints(a.points.map((pp, j) => j === i ? { ...pp, y: Number(e.target.value) } : pp))}
                      className="w-full bg-transparent outline-none focus:bg-yellow-50 px-1"
                    />
                  </td>
                  <td className="border-b border-l border-neutral-100 text-center">
                    <button
                      onClick={() => setPoints(a.points.filter((_, j) => j !== i))}
                      className="text-neutral-400 hover:text-red-600 text-[12px] px-1"
                      title="Remove point"
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scrolling SVG canvas */}
      <div className="overflow-auto max-h-[520px] bg-white" data-no-drag>
        <svg
          ref={svgRef}
          width={W} height={H}
          onClick={handleSvgClick}
          onMouseDown={onSvgMouseDown}
          onMouseMove={onSvgMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          className={cn(
            "bg-white",
            mode === "plot" && "cursor-crosshair",
            mode === "moveX" && "cursor-ns-resize",
            mode === "moveY" && "cursor-ew-resize",
          )}
        >
          {/* Minor grid — 5 subdivisions per square (0.2, 0.4, 0.6, 0.8) */}
          {Array.from({ length: a.squaresX * 5 + 1 }, (_, i) => i).map((i) => {
            const x = (i / 5) * SQ;
            const isMajor = i % 5 === 0;
            return (
              <line
                key={`mx${i}`} x1={x} y1={0} x2={x} y2={H}
                stroke={isMajor ? "hsl(0 0% 78%)" : "hsl(0 0% 92%)"}
                strokeWidth={isMajor ? 1 : 0.5}
              />
            );
          })}
          {Array.from({ length: a.squaresY * 5 + 1 }, (_, i) => i).map((i) => {
            const y = (i / 5) * SQ;
            const isMajor = i % 5 === 0;
            return (
              <line
                key={`my${i}`} x1={0} y1={y} x2={W} y2={y}
                stroke={isMajor ? "hsl(0 0% 78%)" : "hsl(0 0% 92%)"}
                strokeWidth={isMajor ? 1 : 0.5}
              />
            );
          })}

          {/* Axes — heavy black lines, yellow while their move tool is active */}
          <line
            x1={0} y1={oyPx} x2={W} y2={oyPx}
            stroke={mode === "moveX" ? "hsl(45 95% 50%)" : "hsl(0 0% 10%)"}
            strokeWidth={mode === "moveX" ? 2.4 : 2}
          />
          <line
            x1={oxPx} y1={0} x2={oxPx} y2={H}
            stroke={mode === "moveY" ? "hsl(45 95% 50%)" : "hsl(0 0% 10%)"}
            strokeWidth={mode === "moveY" ? 2.4 : 2}
          />

          {/* Tick labels — re-derived from origin + scale */}
          {xTicks.map((i) => {
            const val = round((i - a.originSquareX) * a.unitsPerSquareX);
            if (val === 0) return null;
            return (
              <text key={`tx${i}`} x={i * SQ} y={oyPx + 12} fontSize="9.5" textAnchor="middle" fill="hsl(0 0% 35%)">{val}</text>
            );
          })}
          {yTicks.map((i) => {
            const val = round((a.originSquareY - i) * a.unitsPerSquareY);
            if (val === 0) return null;
            return (
              <text key={`ty${i}`} x={oxPx - 4} y={i * SQ + 3} fontSize="9.5" textAnchor="end" fill="hsl(0 0% 35%)">{val}</text>
            );
          })}

          {/* Axis names */}
          <text x={W - 6} y={oyPx - 6} fontSize="11" textAnchor="end" fontStyle="italic" fill="hsl(0 0% 25%)">{a.xLabel}</text>
          <text x={oxPx + 6} y={12} fontSize="11" fontStyle="italic" fill="hsl(0 0% 25%)">{a.yLabel}</text>

          {/* Connection path */}
          {connect !== "scatter" && path && (
            <path
              d={path} fill="none" stroke="hsl(220 90% 50%)" strokeWidth={1.75}
              strokeDasharray={connect === "broken" ? "6 4" : undefined}
            />
          )}

          {/* Points */}
          {a.points.map((p, i) => {
            const { x, y } = toPx(p);
            return (
              <g key={`p${i}`}>
                <circle cx={x} cy={y} r={3.5} fill="hsl(220 90% 50%)" stroke="white" strokeWidth={1} />
                <text x={x + 5} y={y - 5} fontSize="9" fill="hsl(0 0% 30%)">({p.x},{p.y})</text>
              </g>
            );
          })}

          {/* Geometry shapes drawn on top of the graph (Diagram inside graph) */}
          {(a.shapes ?? []).map((s) => (
            <ShapeNode key={s.id} shape={s} />
          ))}
          {geomActive && geomDraft.length > 0 && (
            <g opacity={0.6}>
              {geomDraft.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill="hsl(45 95% 45%)" />
              ))}
              {geomDraft.length >= 2 && (
                <polyline
                  points={geomDraft.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke="hsl(45 95% 45%)" strokeDasharray="4 3" strokeWidth={1.25}
                />
              )}
            </g>
          )}
        </svg>
      </div>
    </NodeViewWrapper>
  );
}


// ---------- small presentational helpers ----------------------------------

/** Render a geometry shape (point/line/circle/arc/polygon) in SVG pixel space. */
function ShapeNode({ shape }: { shape: GraphShape }) {
  const stroke = "hsl(220 90% 35%)";
  const fill = "none";
  if (shape.kind === "point" && shape.pts[0]) {
    const p = shape.pts[0];
    return <circle cx={p.x} cy={p.y} r={4} fill={stroke} />;
  }
  if (shape.kind === "line" && shape.pts.length >= 2) {
    const [a, b] = shape.pts;
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={1.5} />;
  }
  if (shape.kind === "circle" && shape.pts.length >= 2) {
    const [c, r] = shape.pts;
    const radius = Math.hypot(r.x - c.x, r.y - c.y);
    return <circle cx={c.x} cy={c.y} r={radius} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  }
  if (shape.kind === "arc" && shape.pts.length >= 3) {
    // 3-point arc → approximate as polyline through the points (lightweight).
    const d = `M ${shape.pts[0].x} ${shape.pts[0].y} Q ${shape.pts[1].x} ${shape.pts[1].y} ${shape.pts[2].x} ${shape.pts[2].y}`;
    return <path d={d} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  }
  if (shape.kind === "polygon" && shape.pts.length >= 2) {
    return (
      <polygon
        points={shape.pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="hsla(220, 90%, 50%, 0.06)" stroke={stroke} strokeWidth={1.5}
      />
    );
  }
  return null;
}


function ToolButton({
  active, onClick, icon, label,
}: { active?: boolean; onClick: () => void; icon?: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2 inline-flex items-center gap-1 rounded border text-[11px] transition-colors",
        active
          ? "bg-yellow-300 border-yellow-400 text-neutral-900 font-medium"
          : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} title={title}
      className="h-7 w-7 inline-flex items-center justify-center rounded border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
    >{children}</button>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-neutral-600">{label}</span>
      <Input
        type="number" value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-7 w-20 text-[11px] bg-white"
      />
    </label>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function round(v: number) { return Math.round(v * 100) / 100; }

/** Build an SVG path from pixel-space points using the chosen connect style. */
function buildPath(pts: { x: number; y: number }[], style: ConnectStyle): string | null {
  if (pts.length < 2) return null;
  if (style === "scatter") return null;
  if (style === "smooth" && pts.length >= 3) {
    const d: string[] = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`);
    }
    return d.join(" ");
  }
  return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}
