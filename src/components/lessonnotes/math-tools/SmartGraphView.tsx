// Smart Graph NodeView — a real graph-paper canvas embedded in the lesson note.
//
// Design (Nov 2026 rework):
//   - No X/Y data table. Plotting a point just drops a dot on the paper.
//   - Four-sided Expand controls (top / bottom / left / right) add one
//     centimetre (= one major square = 5 minor grids) of graph paper at a
//     time. The existing content stays anchored to its data coordinates.
//     Trim buttons (−) remove an empty edge row/column.
//   - "Expand" ≠ "Zoom". SQ (px per cm) is constant; only the number of
//     squares changes. Document-level zoom (page header) is still what
//     makes things visually larger/smaller.
//   - The graph is the lesson-note surface. A Cursor tool marks an insertion
//     point; an Insert dropdown drops overlay objects (text, formula,
//     triangle, circle, rectangle, angle, image) at that point, all stored
//     on the node attrs in data coordinates.

import { useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Minus, Trash2, Undo2, Redo2, Eraser, ChevronDown, ChevronUp, Move,
  GripVertical, ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, LineChart,
  Sparkles, MousePointer2, Type, Sigma, Triangle as TriangleIcon,
  Circle as CircleIcon, Square as SquareIcon, Image as ImageIcon,
} from "lucide-react";
import type {
  GraphPoint, ConnectStyle, GraphShape, GraphOverlay, SmartGraphAttrs,
} from "@/components/lessonnotes/extensions/SmartGraph";
import { cn } from "@/lib/utils";
import { useGeometryMode } from "@/components/lessonnotes/geometry-editor/GeometryModeContext";
import type { GraphFunction } from "@/lib/graph/graphModel";
import { tryCompile, sampleFunction } from "@/lib/graph/functions";
import { GRAPH_TEMPLATES, nextFunctionColour } from "@/lib/graph/library";
import { GRAPH_THEMES, graphInk } from "@/lib/graph/graphTheme";
import type { GraphInk } from "@/lib/graph/graphTheme";
import type { GraphThemeId } from "@/lib/graph/graphTheme";

const SQ_BASE = 28; // pixels per major square (= 1 cm on the printed page) at 100% graph zoom.

type Mode = "plot" | "cursor" | "moveX" | "moveY";

export function SmartGraphView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as unknown as SmartGraphAttrs;
  const update = (patch: Partial<SmartGraphAttrs>) =>
    updateAttributes(patch as Record<string, unknown>);

  const overlays = a.overlays ?? [];
  const shapes = a.shapes ?? [];

  // ---- Two-colour ink system ----------------------------------------------
  // One background + one foreground colour. Axes, numbers, labels and both
  // grid levels are the same ink at different opacities.
  const style = a.style ?? undefined;
  const ink = graphInk(style?.theme, style?.majorAlpha, style?.minorAlpha);
  const minorPerMajor = Math.max(1, Math.round(style?.minorPerMajor ?? 5));
  const axisWidth = style?.axisWidth ?? 2;
  const setStyle = (patch: Record<string, unknown>) =>
    update({ style: { ...(style ?? {}), ...patch } as SmartGraphAttrs["style"] });

  // ---- Local interaction state ---------------------------------------------
  const [mode, setMode] = useState<Mode>("plot");
  const [showMore, setShowMore] = useState(false);
  const [connect, setConnect] = useState<ConnectStyle>(a.connect ?? "straight");
  useEffect(() => { if (a.connect && a.connect !== connect) setConnect(a.connect); }, [a.connect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cursor insertion point (in DATA coordinates). Null until first placed.
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // ---- Graph object frame + independent graph zoom -------------------------
  // The graph is an object on the lesson-note canvas: it owns its position
  // (offsetX/offsetY, applied as a transform so the page never reflows), its
  // size (frameW/frameH) and its own zoom (viewZoom → pixels per centimetre).
  const zoom = a.viewZoom ?? 1;
  const SQ = SQ_BASE * zoom;
  const frameW = a.frameW ?? 980;
  const frameH = a.frameH ?? 480;
  const [objActive, setObjActive] = useState(false);
  const active = selected || objActive;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!objActive) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setObjActive(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [objActive]);

  // Move the graph object (only the object — never the page behind it).
  const startMove = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setObjActive(true);
    const sx = e.clientX, sy = e.clientY;
    const ox = a.offsetX ?? 0, oy = a.offsetY ?? 0;
    const move = (ev: PointerEvent) => {
      update({ offsetX: ox + (ev.clientX - sx), offsetY: oy + (ev.clientY - sy) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Resize the graph object. The mathematical grid re-flows to the new size:
  // we add/remove whole centimetre squares instead of stretching the picture,
  // keeping the origin at the same relative place.
  const startResize = (corner: "nw" | "ne" | "sw" | "se" | "e" | "s") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setObjActive(true);
    const sx = e.clientX, sy = e.clientY;
    const w0 = frameW, h0 = frameH;
    const ox = a.offsetX ?? 0, oy = a.offsetY ?? 0;
    const sqX0 = a.squaresX, sqY0 = a.squaresY;
    const orX0 = a.originSquareX, orY0 = a.originSquareY;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      const west = corner === "nw" || corner === "sw";
      const north = corner === "nw" || corner === "ne";
      const w = Math.max(280, w0 + (west ? -dx : corner === "s" ? 0 : dx));
      const h = Math.max(200, h0 + (north ? -dy : corner === "e" ? 0 : dy));
      const nSqX = Math.max(4, Math.round((w - 96) / SQ));
      const nSqY = Math.max(4, Math.round((h - 24) / SQ));
      update({
        frameW: w,
        frameH: h,
        offsetX: west ? ox + (w0 - w) : ox,
        offsetY: north ? oy + (h0 - h) : oy,
        squaresX: nSqX,
        squaresY: nSqY,
        originSquareX: Math.max(0, Math.min(nSqX, Math.round((orX0 / sqX0) * nSqX))),
        originSquareY: Math.max(0, Math.min(nSqY, Math.round((orY0 / sqY0) * nSqY))),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const setZoom = (z: number) => update({ viewZoom: Math.max(0.25, Math.min(4, Math.round(z * 100) / 100)) });

  /** Make the graph landscape and fill the frame with squares. */
  const fitGrid = () => {
    const nSqX = Math.max(4, Math.round((frameW - 96) / SQ));
    const nSqY = Math.max(4, Math.round((frameH - 24) / SQ));
    update({
      squaresX: nSqX,
      squaresY: nSqY,
      originSquareX: Math.round(nSqX / 2),
      originSquareY: Math.round(nSqY / 2),
    });
  };

  // ---- Geometry helpers ----------------------------------------------------
  const W = a.squaresX * SQ;
  const H = a.squaresY * SQ;
  const oxPx = a.originSquareX * SQ;
  const oyPx = a.originSquareY * SQ;

  const toPx = (p: { x: number; y: number }) => ({
    x: oxPx + (p.x / a.unitsPerSquareX) * SQ,
    y: oyPx - (p.y / a.unitsPerSquareY) * SQ,
  });
  const toData = (px: number, py: number): GraphPoint => ({
    x: Math.round(((px - oxPx) / SQ) * a.unitsPerSquareX * 100) / 100,
    y: Math.round(((oyPx - py) / SQ) * a.unitsPerSquareY * 100) / 100,
  });

  // ---- Smart Scale assistant ----------------------------------------------
  const scaleSuggestion = useMemo(() => {
    const pts = a.points ?? [];
    if (pts.length === 0) return null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const xMin = Math.min(0, ...xs), xMax = Math.max(0, ...xs);
    const yMin = Math.min(0, ...ys), yMax = Math.max(0, ...ys);
    const xRange = Math.max(1e-6, xMax - xMin);
    const yRange = Math.max(1e-6, yMax - yMin);
    const nice = (raw: number) => {
      if (raw <= 0) return 1;
      const pow = Math.pow(10, Math.floor(Math.log10(raw)));
      const f = raw / pow;
      const m = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
      return m * pow;
    };
    const targetSquaresX = Math.max(8, Math.min(a.squaresX - 2, 14));
    const targetSquaresY = Math.max(6, Math.min(a.squaresY - 2, 10));
    const sx = nice(xRange / targetSquaresX);
    const sy = nice(yRange / targetSquaresY);
    const changeX = Math.abs(sx - a.unitsPerSquareX) / a.unitsPerSquareX > 0.25;
    const changeY = Math.abs(sy - a.unitsPerSquareY) / a.unitsPerSquareY > 0.25;
    if (!changeX && !changeY) return null;
    const currentSpanX = a.squaresX * a.unitsPerSquareX;
    const currentSpanY = a.squaresY * a.unitsPerSquareY;
    const overflow = xRange > currentSpanX * 0.95 || yRange > currentSpanY * 0.95;
    const cramped = xRange < currentSpanX * 0.15 || yRange < currentSpanY * 0.15;
    const reason = overflow
      ? "Current scale is too small — some plotted points fall off the page."
      : cramped
        ? "Current scale is too large — the graph looks cramped near the origin."
        : "This scale fits all plotted points neatly on the page.";
    return { sx, sy, reason };
  }, [a.points, a.unitsPerSquareX, a.unitsPerSquareY, a.squaresX, a.squaresY]);

  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  useEffect(() => { setSuggestionDismissed(false); }, [scaleSuggestion?.sx, scaleSuggestion?.sy, scaleSuggestion?.reason]);
  const applyScaleSuggestion = () => {
    if (!scaleSuggestion) return;
    update({ unitsPerSquareX: scaleSuggestion.sx, unitsPerSquareY: scaleSuggestion.sy });
    setScaleXText(`1 cm = ${scaleSuggestion.sx} unit${scaleSuggestion.sx === 1 ? "" : "s"}`);
    setScaleYText(`1 cm = ${scaleSuggestion.sy} unit${scaleSuggestion.sy === 1 ? "" : "s"}`);
  };

  // ---- Geometry-inside-graph (document-wide geometry mode) -----------------
  const geo = useGeometryMode();
  const geomActive = geo.mode && ["point", "line", "circle", "arc", "polygon"].includes(geo.tool);
  const [geomDraft, setGeomDraft] = useState<Array<{ x: number; y: number }>>([]);
  useEffect(() => { setGeomDraft([]); }, [geo.tool, geo.mode]);

  const setShapes = (s: GraphShape[]) => update({ shapes: s });
  const addShape = (kind: GraphShape["kind"], ptsData: Array<{ x: number; y: number }>) =>
    setShapes([...shapes, { id: `s${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind, pts: ptsData }]);

  // ---- Manual scale entry --------------------------------------------------
  const [scaleXText, setScaleXText] = useState(`1 cm = ${a.unitsPerSquareX} unit${a.unitsPerSquareX === 1 ? "" : "s"}`);
  const [scaleYText, setScaleYText] = useState(`1 cm = ${a.unitsPerSquareY} unit${a.unitsPerSquareY === 1 ? "" : "s"}`);
  const parseScale = (txt: string): number | null => {
    const m = txt.match(/(-?\d*\.?\d+)\s*(?:cm)?\s*=\s*(-?\d*\.?\d+)/i);
    if (m) {
      const lhs = Number(m[1]); const rhs = Number(m[2]);
      if (lhs > 0 && Number.isFinite(rhs)) return rhs / lhs;
      return null;
    }
    const n = Number(txt);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const commitScaleX = () => { const v = parseScale(scaleXText); if (v && v !== a.unitsPerSquareX) update({ unitsPerSquareX: v }); };
  const commitScaleY = () => { const v = parseScale(scaleYText); if (v && v !== a.unitsPerSquareY) update({ unitsPerSquareY: v }); };

  // ---- Undo / Redo — snapshots points + shapes + overlays together ---------
  type Snap = { points: GraphPoint[]; shapes: GraphShape[]; overlays: GraphOverlay[] };
  const historyRef = useRef<Snap[]>([{ points: a.points ?? [], shapes, overlays }]);
  const cursorRef = useRef(0);
  const skipHistoryRef = useRef(false);
  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    const last = historyRef.current[cursorRef.current];
    if (last && last.points === a.points && last.shapes === shapes && last.overlays === overlays) return;
    historyRef.current = historyRef.current.slice(0, cursorRef.current + 1);
    historyRef.current.push({ points: a.points ?? [], shapes, overlays });
    cursorRef.current = historyRef.current.length - 1;
  }, [a.points, shapes, overlays]);
  const applySnap = (s: Snap) => {
    skipHistoryRef.current = true;
    update({ points: s.points, shapes: s.shapes, overlays: s.overlays });
  };
  const undo = () => { if (cursorRef.current > 0) { cursorRef.current -= 1; applySnap(historyRef.current[cursorRef.current]); } };
  const redo = () => { if (cursorRef.current < historyRef.current.length - 1) { cursorRef.current += 1; applySnap(historyRef.current[cursorRef.current]); } };
  const setPoints = (pts: GraphPoint[]) => update({ points: pts });

  // ---- Expand / Trim controls ---------------------------------------------
  // Every expand adds one major square (= 1 cm = 5 minor grid steps).
  const expand = (side: "top" | "bottom" | "left" | "right") => {
    if (side === "top") update({ squaresY: a.squaresY + 1, originSquareY: a.originSquareY + 1 });
    else if (side === "bottom") update({ squaresY: a.squaresY + 1 });
    else if (side === "left") update({ squaresX: a.squaresX + 1, originSquareX: a.originSquareX + 1 });
    else update({ squaresX: a.squaresX + 1 });
  };
  // Trim only shrinks empty edges. Guardrails keep origin and all content inside.
  const contentBoundsSq = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const bump = (px: number, py: number) => {
      const sx = px / SQ, sy = py / SQ;
      if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    };
    for (const p of a.points ?? []) { const q = toPx(p); bump(q.x, q.y); }
    for (const s of shapes) for (const p of s.pts) { const q = toPx(p); bump(q.x, q.y); }
    for (const o of overlays) { const q = toPx(o); bump(q.x, q.y); }
    // Origin is content too, so trim never eats the axis.
    bump(oxPx, oyPx);
    return { minX, maxX, minY, maxY };
  }, [a.points, shapes, overlays, oxPx, oyPx]); // eslint-disable-line react-hooks/exhaustive-deps
  const canTrim = (side: "top" | "bottom" | "left" | "right") => {
    const b = contentBoundsSq;
    if (side === "top") return a.squaresY > 4 && b.minY >= 1;
    if (side === "bottom") return a.squaresY > 4 && b.maxY <= a.squaresY - 1;
    if (side === "left") return a.squaresX > 4 && b.minX >= 1;
    return a.squaresX > 4 && b.maxX <= a.squaresX - 1;
  };
  const trim = (side: "top" | "bottom" | "left" | "right") => {
    if (!canTrim(side)) return;
    if (side === "top") update({ squaresY: a.squaresY - 1, originSquareY: Math.max(0, a.originSquareY - 1) });
    else if (side === "bottom") update({ squaresY: a.squaresY - 1 });
    else if (side === "left") update({ squaresX: a.squaresX - 1, originSquareX: Math.max(0, a.originSquareX - 1) });
    else update({ squaresX: a.squaresX - 1 });
  };

  // ---- Canvas interactions -------------------------------------------------
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<null | "x" | "y" | "overlay">(null);
  const overlayDragRef = useRef<{ id: string } | null>(null);

  const snapToHalfSquare = (px: number, py: number) => ({
    x: Math.round((px / SQ) * 2) / 2 * SQ,
    y: Math.round((py / SQ) * 2) / 2 * SQ,
  });

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!svgRef.current || draggingRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Geometry-mode interception (uses DATA coordinates now).
    if (geomActive) {
      const s = snapToHalfSquare(px, py);
      const p = toData(s.x, s.y);
      const t = geo.tool as GraphShape["kind"];
      if (t === "point") { addShape("point", [p]); return; }
      if (t === "line") {
        if (geomDraft.length === 0) setGeomDraft([p]);
        else { addShape("line", [geomDraft[0], p]); setGeomDraft([]); }
        return;
      }
      if (t === "circle" || t === "arc") {
        const next = [...geomDraft, p];
        if (next.length < (t === "arc" ? 3 : 2)) setGeomDraft(next);
        else { addShape(t, next); setGeomDraft([]); }
        return;
      }
      if (t === "polygon") {
        if (e.detail >= 2 && geomDraft.length >= 2) { addShape("polygon", geomDraft); setGeomDraft([]); }
        else setGeomDraft([...geomDraft, p]);
        return;
      }
    }

    if (mode === "plot") {
      const s = snapToHalfSquare(px, py);
      setPoints([...(a.points ?? []), toData(s.x, s.y)]);
      return;
    }
    if (mode === "cursor") {
      const s = snapToHalfSquare(px, py);
      setCursor(toData(s.x, s.y));
      setSelectedOverlayId(null);
      return;
    }
  };

  const onSvgMouseDown = (e: React.MouseEvent) => {
    if (mode === "moveX") draggingRef.current = "x";
    else if (mode === "moveY") draggingRef.current = "y";
  };
  const onSvgMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (draggingRef.current === "x") {
      const sq = Math.max(0, Math.min(a.squaresY, Math.round((e.clientY - rect.top) / SQ)));
      if (sq !== a.originSquareY) update({ originSquareY: sq });
    } else if (draggingRef.current === "y") {
      const sq = Math.max(0, Math.min(a.squaresX, Math.round((e.clientX - rect.left) / SQ)));
      if (sq !== a.originSquareX) update({ originSquareX: sq });
    } else if (draggingRef.current === "overlay" && overlayDragRef.current) {
      const id = overlayDragRef.current.id;
      const s = snapToHalfSquare(e.clientX - rect.left, e.clientY - rect.top);
      const d = toData(s.x, s.y);
      update({ overlays: overlays.map((o) => (o.id === id ? { ...o, x: d.x, y: d.y } : o)) });
    }
  };
  const endDrag = () => { draggingRef.current = null; overlayDragRef.current = null; };

  // ---- Overlay CRUD --------------------------------------------------------
  const insertOverlay = (kind: GraphOverlay["kind"]) => {
    const pos = cursor ?? toData(oxPx, oyPx);
    const id = `o${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const base: GraphOverlay = { id, kind, x: pos.x, y: pos.y };
    let overlay: GraphOverlay = base;
    if (kind === "text") overlay = { ...base, payload: { text: "Text" } };
    else if (kind === "formula") overlay = { ...base, payload: { latex: "x^2" } };
    else if (kind === "triangle") overlay = { ...base, w: 3 * a.unitsPerSquareX, h: 3 * a.unitsPerSquareY };
    else if (kind === "rectangle") overlay = { ...base, w: 3 * a.unitsPerSquareX, h: 2 * a.unitsPerSquareY };
    else if (kind === "circle") overlay = { ...base, w: 2 * a.unitsPerSquareX, h: 2 * a.unitsPerSquareY };
    else if (kind === "angle") overlay = { ...base, w: 3 * a.unitsPerSquareX, h: 3 * a.unitsPerSquareY, payload: { degrees: 45 } };
    else if (kind === "image") overlay = { ...base, w: 4 * a.unitsPerSquareX, h: 3 * a.unitsPerSquareY, payload: { src: "" } };
    update({ overlays: [...overlays, overlay] });
    setSelectedOverlayId(id);
    setInsertOpen(false);
  };
  const updateOverlay = (id: string, patch: Partial<GraphOverlay>) => {
    update({ overlays: overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  };
  const deleteOverlay = (id: string) => {
    update({ overlays: overlays.filter((o) => o.id !== id) });
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  };

  // Keyboard delete for selected overlay
  useEffect(() => {
    if (!selectedOverlayId) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        deleteOverlay(selectedOverlayId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedOverlayId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Derived render data -------------------------------------------------
  const path = useMemo(
    () => buildPath((a.points ?? []).map((p) => toPx(p)), connect),
    [a.points, connect, oxPx, oyPx, a.unitsPerSquareX, a.unitsPerSquareY], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const xTicks = useMemo(() => Array.from({ length: a.squaresX + 1 }, (_, i) => i), [a.squaresX]);
  const yTicks = useMemo(() => Array.from({ length: a.squaresY + 1 }, (_, i) => i), [a.squaresY]);
  const cursorPx = cursor ? toPx(cursor) : null;

  // ---- Function plotting ---------------------------------------------------
  const functions = a.functions ?? [];
  const [fnText, setFnText] = useState("");
  const [fnFrom, setFnFrom] = useState("");
  const [fnTo, setFnTo] = useState("");
  const [fnError, setFnError] = useState<string | null>(null);

  const dataX0 = ((0 - oxPx) / SQ) * a.unitsPerSquareX;
  const dataX1 = ((W - oxPx) / SQ) * a.unitsPerSquareX;
  const dataY0 = ((oyPx - H) / SQ) * a.unitsPerSquareY;
  const dataY1 = ((oyPx - 0) / SQ) * a.unitsPerSquareY;

  const addFunction = () => {
    const { fn, error } = tryCompile(fnText);
    if (!fn) { setFnError(error); return; }
    const from = fnFrom.trim() === "" ? null : Number(fnFrom);
    const to = fnTo.trim() === "" ? null : Number(fnTo);
    const f: GraphFunction = {
      id: `f${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      expression: fnText.trim().replace(/^y\s*=\s*/i, ""),
      colour: nextFunctionColour(functions.length, ink.ink),
      thickness: 2,
      dash: "solid",
      domainMin: Number.isFinite(from as number) ? from : null,
      domainMax: Number.isFinite(to as number) ? to : null,
    };
    update({ functions: [...functions, f] });
    setFnText(""); setFnFrom(""); setFnTo(""); setFnError(null);
  };

  const fnPaths = useMemo(() => {
    return functions.filter((f) => !f.hidden).map((f) => {
      const { fn } = tryCompile(f.expression);
      if (!fn) return { f, d: [] as string[] };
      const x0 = Math.max(dataX0, f.domainMin ?? dataX0);
      const x1 = Math.min(dataX1, f.domainMax ?? dataX1);
      if (!(x1 > x0)) return { f, d: [] as string[] };
      const segs = sampleFunction(fn, x0, x1, { yMin: dataY0, yMax: dataY1, samples: Math.max(200, Math.round(W)) });
      const d = segs.map((seg) => seg.map((pt, i) => {
        const q = toPx(pt);
        return `${i === 0 ? "M" : "L"} ${q.x} ${q.y}`;
      }).join(" "));
      return { f, d };
    });
  }, [functions, dataX0, dataX1, dataY0, dataY1, W, SQ, oxPx, oyPx, a.unitsPerSquareX, a.unitsPerSquareY]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- UI ------------------------------------------------------------------
  return (
    <NodeViewWrapper as="div" className="my-4" data-graph-object="">
      <div
        ref={rootRef}
        onMouseDown={() => setObjActive(true)}
        className={cn(
          "relative rounded-md border bg-white text-neutral-900",
          active ? "border-yellow-400 shadow-md" : "border-neutral-200",
        )}
        style={{
          width: frameW,
          maxWidth: "none",
          transform: `translate(${a.offsetX ?? 0}px, ${a.offsetY ?? 0}px)`,
        }}
      >
      {/* Essentials toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-neutral-200 bg-white text-[12px]">
        <span
          onPointerDown={startMove}
          title="Drag to move the graph anywhere on the page"
          className="mr-1 inline-flex cursor-grab items-center gap-1 rounded px-1 py-0.5 font-semibold hover:bg-neutral-100 active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5 text-neutral-400" /> Graph
        </span>

        <ToolButton active={mode === "plot"} onClick={() => setMode("plot")} icon={<Plus className="h-3.5 w-3.5" />} label="Plot" />
        <ToolButton active={mode === "cursor"} onClick={() => setMode("cursor")} icon={<MousePointer2 className="h-3.5 w-3.5" />} label="Cursor" />

        {/* Insert dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setInsertOpen((s) => !s)}
            className="h-7 px-2 inline-flex items-center gap-1 rounded border border-neutral-200 bg-white text-[11px] text-neutral-700 hover:bg-neutral-50"
          >
            Insert <ChevronDown className="h-3 w-3" />
          </button>
          {insertOpen && (
            <div className="absolute z-30 mt-1 left-0 w-44 rounded-md border border-neutral-200 bg-white shadow-md py-1">
              <InsertRow icon={<Type className="h-3.5 w-3.5" />} label="Text" onClick={() => insertOverlay("text")} />
              <InsertRow icon={<Sigma className="h-3.5 w-3.5" />} label="Formula" onClick={() => insertOverlay("formula")} />
              <InsertRow icon={<TriangleIcon className="h-3.5 w-3.5" />} label="Triangle" onClick={() => insertOverlay("triangle")} />
              <InsertRow icon={<CircleIcon className="h-3.5 w-3.5" />} label="Circle" onClick={() => insertOverlay("circle")} />
              <InsertRow icon={<SquareIcon className="h-3.5 w-3.5" />} label="Rectangle" onClick={() => insertOverlay("rectangle")} />
              <InsertRow icon={<span className="text-[11px] font-semibold">∠</span>} label="Angle" onClick={() => insertOverlay("angle")} />
              <InsertRow icon={<ImageIcon className="h-3.5 w-3.5" />} label="Image" onClick={() => insertOverlay("image")} />
            </div>
          )}
        </div>

        <span className="mx-1 h-5 w-px bg-neutral-200" />

        <ToolButton active={mode === "moveX"} onClick={() => setMode("moveX")} icon={<Move className="h-3.5 w-3.5 rotate-90" />} label="Move X" />
        <ToolButton active={mode === "moveY"} onClick={() => setMode("moveY")} icon={<Move className="h-3.5 w-3.5" />} label="Move Y" />

        <span className="mx-1 h-5 w-px bg-neutral-200" />

        {[
          { v: "straight" as const, label: "Line" },
          { v: "smooth" as const, label: "Curve" },
          { v: "broken" as const, label: "Broken" },
          { v: "scatter" as const, label: "Scatter" },
        ].map((c) => (
          <ToolButton key={c.v} active={connect === c.v}
            onClick={() => { setConnect(c.v); update({ connect: c.v }); }} label={c.label} />
        ))}

        <span className="mx-1 h-5 w-px bg-neutral-200" />

        <IconBtn onClick={undo} title="Undo"><Undo2 className="h-3.5 w-3.5" /></IconBtn>
        <IconBtn onClick={redo} title="Redo"><Redo2 className="h-3.5 w-3.5" /></IconBtn>
        <IconBtn onClick={() => update({ points: [], shapes: [], overlays: [] })} title="Clear graph"><Eraser className="h-3.5 w-3.5" /></IconBtn>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 inline-flex items-center gap-1 rounded border border-neutral-200 px-1">
            <IconBtn onClick={() => setZoom(zoom / 1.25)} title="Graph zoom out"><ZoomOut className="h-3.5 w-3.5" /></IconBtn>
            <span className="w-9 text-center text-[10px] text-neutral-600">{Math.round(zoom * 100)}%</span>
            <IconBtn onClick={() => setZoom(zoom * 1.25)} title="Graph zoom in"><ZoomIn className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn onClick={() => setZoom(1)} title="Reset graph zoom">100</IconBtn>
            <IconBtn onClick={fitGrid} title="Fit grid to the graph object (landscape)"><Maximize2 className="h-3.5 w-3.5" /></IconBtn>
          </span>
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

      {/* Scale row */}
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
        <span className="text-neutral-400 text-[11px]">
          Tip: use the <em>+</em> buttons around the paper to add graph area (1 cm each). Zoom the page from the header — the scale never changes.
        </span>
      </div>

      {/* Function row — y = expression, optional domain */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-neutral-200 bg-white text-[12px]">
        <span className="inline-flex items-center gap-1 text-neutral-600"><LineChart className="h-3.5 w-3.5" /> y =</span>
        <Input
          value={fnText}
          onChange={(e) => { setFnText(e.target.value); setFnError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFunction(); } }}
          placeholder="2x + 3"
          className="h-7 w-40 text-[12px] bg-white"
        />
        <span className="text-neutral-500">from</span>
        <Input value={fnFrom} onChange={(e) => setFnFrom(e.target.value)} placeholder="−10"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFunction(); } }}
          className="h-7 w-16 text-[12px] bg-white" />
        <span className="text-neutral-500">to</span>
        <Input value={fnTo} onChange={(e) => setFnTo(e.target.value)} placeholder="10"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFunction(); } }}
          className="h-7 w-16 text-[12px] bg-white" />
        <Button type="button" size="sm" onClick={addFunction}
          className="h-7 px-3 text-[11px] bg-yellow-300 hover:bg-yellow-400 text-neutral-900 border border-yellow-400">Plot</Button>
        <select
          value=""
          onChange={(e) => { if (e.target.value) setFnText(e.target.value); }}
          className="h-7 rounded border border-neutral-200 bg-white px-1 text-[11px] text-neutral-700"
        >
          <option value="">Library…</option>
          {GRAPH_TEMPLATES.map((t) => (
            <option key={t.label} value={t.expression}>{t.label}</option>
          ))}
        </select>
        {fnError && <span className="text-[11px] text-red-600">{fnError}</span>}
        <div className="flex flex-wrap items-center gap-1.5">
          {functions.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px]">
              <span className="h-2 w-2 rounded-full" style={{ background: f.colour }} />
              y = {f.expression}
              <button type="button" title={f.hidden ? "Show" : "Hide"}
                onClick={() => update({ functions: functions.map((g) => (g.id === f.id ? { ...g, hidden: !g.hidden } : g)) })}
                className="text-neutral-500 hover:text-neutral-800">
                {f.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
              <button type="button" title="Remove"
                onClick={() => update({ functions: functions.filter((g) => g.id !== f.id) })}
                className="text-neutral-400 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Smart Scale suggestion */}
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
            <Button type="button" size="sm" onClick={applyScaleSuggestion}
              className="h-7 px-3 text-[11px] bg-yellow-300 hover:bg-yellow-400 text-neutral-900 border border-yellow-400">Accept</Button>
            <button type="button" onClick={() => setSuggestionDismissed(true)}
              className="h-7 px-2 text-[11px] text-neutral-500 hover:text-neutral-700">Ignore</button>
          </div>
        </div>
      )}

      {geo.mode && (
        <div className="px-3 py-1.5 border-b border-neutral-200 bg-white text-[11px] text-yellow-700">
          Diagram mode: click in graph to draw <strong>{geo.tool}</strong>
          {geomDraft.length > 0 && ` (${geomDraft.length} pt${geomDraft.length === 1 ? "" : "s"})`}
        </div>
      )}

      {/* More — axis labels only. Grid/origin driven by expand buttons. */}
      {showMore && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-neutral-200 bg-neutral-50 text-[11px]">
          <label className="inline-flex items-center gap-1.5">
            <span className="text-neutral-600">X label</span>
            <Input value={a.xLabel} onChange={(e) => update({ xLabel: e.target.value })} className="h-7 w-20 text-[11px] bg-white" />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-neutral-600">Y label</span>
            <Input value={a.yLabel} onChange={(e) => update({ yLabel: e.target.value })} className="h-7 w-20 text-[11px] bg-white" />
          </label>
          <span className="text-neutral-500">Grid: {a.squaresX}×{a.squaresY} cm · Origin: ({a.originSquareX}, {a.originSquareY})</span>

          <span className="mx-1 h-5 w-px bg-neutral-200" />

          {/* Two-colour theme: one background + one ink colour. */}
          <span className="text-neutral-600">Colour</span>
          <div className="flex items-center gap-1">
            {GRAPH_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                onClick={() => setStyle({ theme: t.id as GraphThemeId })}
                className={cn(
                  "h-6 w-6 rounded-sm border overflow-hidden",
                  (style?.theme ?? "whiteCharcoal") === t.id
                    ? "border-yellow-400 ring-1 ring-yellow-300"
                    : "border-neutral-300",
                )}
              >
                <span className="flex h-full w-full">
                  <span className="h-full w-1/2" style={{ background: t.bg }} />
                  <span className="h-full w-1/2" style={{ background: t.ink }} />
                </span>
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5">
            <span className="text-neutral-600">Major grid</span>
            <input
              type="range" min={5} max={45} step={1}
              value={Math.round((style?.majorAlpha ?? 0.25) * 100)}
              onChange={(e) => setStyle({ majorAlpha: Number(e.target.value) / 100 })}
              className="w-20"
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-neutral-600">Minor grid</span>
            <input
              type="range" min={3} max={30} step={1}
              value={Math.round((style?.minorAlpha ?? 0.1) * 100)}
              onChange={(e) => setStyle({ minorAlpha: Number(e.target.value) / 100 })}
              className="w-20"
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-neutral-600">Subdivisions</span>
            <select
              value={minorPerMajor}
              onChange={(e) => setStyle({ minorPerMajor: Number(e.target.value) })}
              className="h-7 rounded border border-neutral-200 bg-white px-1 text-[11px]"
            >
              {[1, 2, 4, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}

      {/* Canvas with four-sided expand controls */}
      <div className="bg-white p-3">
        <div className="mx-auto" style={{ width: "fit-content", maxWidth: "100%" }}>
          {/* Top row: expand up */}
          <div className="flex justify-center pb-1">
            <EdgeButton onClick={() => expand("top")} title="Add 1 cm on top"><Plus className="h-3 w-3" /></EdgeButton>
            <EdgeButton onClick={() => trim("top")} disabled={!canTrim("top")} title="Trim top row"><Minus className="h-3 w-3" /></EdgeButton>
          </div>

          <div className="flex items-stretch gap-1">
            {/* Left column: expand left */}
            <div className="flex flex-col justify-center gap-1 pr-1">
              <EdgeButton onClick={() => expand("left")} title="Add 1 cm on the left"><Plus className="h-3 w-3" /></EdgeButton>
              <EdgeButton onClick={() => trim("left")} disabled={!canTrim("left")} title="Trim left column"><Minus className="h-3 w-3" /></EdgeButton>
            </div>

            {/* SVG canvas */}
            <div
              className="overflow-auto border border-neutral-200"
              style={{ width: Math.max(160, frameW - 96), height: Math.max(140, frameH - 24) }}
              data-no-drag
            >
              <svg
                ref={svgRef}
                width={W} height={H}
                onClick={handleSvgClick}
                onMouseDown={onSvgMouseDown}
                onMouseMove={onSvgMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                style={{ background: ink.bg }}
                className={cn(
                  "block",
                  mode === "plot" && "cursor-crosshair",
                  mode === "cursor" && "cursor-crosshair",
                  mode === "moveX" && "cursor-ns-resize",
                  mode === "moveY" && "cursor-ew-resize",
                )}
              >
                {/* Minor + major grid (5 minor per major = 1 cm) */}
                {Array.from({ length: a.squaresX * minorPerMajor + 1 }, (_, i) => i).map((i) => {
                  const x = (i / minorPerMajor) * SQ;
                  const isMajor = i % minorPerMajor === 0;
                  return <line key={`mx${i}`} x1={x} y1={0} x2={x} y2={H}
                    stroke={isMajor ? ink.majorGrid : ink.minorGrid}
                    strokeWidth={isMajor ? 1 : 0.5} />;
                })}
                {Array.from({ length: a.squaresY * minorPerMajor + 1 }, (_, i) => i).map((i) => {
                  const y = (i / minorPerMajor) * SQ;
                  const isMajor = i % minorPerMajor === 0;
                  return <line key={`my${i}`} x1={0} y1={y} x2={W} y2={y}
                    stroke={isMajor ? ink.majorGrid : ink.minorGrid}
                    strokeWidth={isMajor ? 1 : 0.5} />;
                })}

                {/* Axes */}
                <line x1={0} y1={oyPx} x2={W} y2={oyPx}
                  stroke={mode === "moveX" ? "hsl(45 95% 50%)" : ink.axis}
                  strokeWidth={mode === "moveX" ? axisWidth + 0.4 : axisWidth} />
                <line x1={oxPx} y1={0} x2={oxPx} y2={H}
                  stroke={mode === "moveY" ? "hsl(45 95% 50%)" : ink.axis}
                  strokeWidth={mode === "moveY" ? axisWidth + 0.4 : axisWidth} />

                {/* Tick labels */}
                {xTicks.map((i) => {
                  const val = round((i - a.originSquareX) * a.unitsPerSquareX);
                  if (val === 0) return null;
                  return <text key={`tx${i}`} x={i * SQ} y={oyPx + 12} fontSize="9.5" textAnchor="middle" fill={ink.text}>{val}</text>;
                })}
                {yTicks.map((i) => {
                  const val = round((a.originSquareY - i) * a.unitsPerSquareY);
                  if (val === 0) return null;
                  return <text key={`ty${i}`} x={oxPx - 4} y={i * SQ + 3} fontSize="9.5" textAnchor="end" fill={ink.text}>{val}</text>;
                })}

                <text x={W - 6} y={oyPx - 6} fontSize="11" textAnchor="end" fontStyle="italic" fill={ink.label}>{a.xLabel}</text>
                <text x={oxPx + 6} y={12} fontSize="11" fontStyle="italic" fill={ink.label}>{a.yLabel}</text>

                {/* Plotted functions */}
                {fnPaths.map(({ f, d }) => (
                  <g key={f.id}>
                    {d.map((seg, i) => (
                      <path key={i} d={seg} fill="none" stroke={f.colour} strokeWidth={f.thickness}
                        strokeDasharray={f.dash === "dashed" ? "6 4" : f.dash === "dotted" ? "2 3" : undefined} />
                    ))}
                  </g>
                ))}

                {/* Plotted line + points */}
                {connect !== "scatter" && path && (
                  <path d={path} fill="none" stroke={ink.ink} strokeWidth={style?.plotWidth ?? 1.75}
                    strokeDasharray={connect === "broken" ? "6 4" : undefined} />
                )}
                {(a.points ?? []).map((p, i) => {
                  const { x, y } = toPx(p);
                  return (
                    <g key={`p${i}`}>
                      <circle cx={x} cy={y} r={style?.pointSize ?? 3.5} fill={ink.ink} stroke={ink.bg} strokeWidth={1} />
                      <text x={x + 5} y={y - 5} fontSize="9" fill={ink.text}>({p.x},{p.y})</text>
                    </g>
                  );
                })}

                {/* Geometry shapes (data coords) */}
                {shapes.map((s) => <ShapeNode key={s.id} shape={s} toPx={toPx} ink={ink} />)}
                {geomActive && geomDraft.length > 0 && (
                  <g opacity={0.6}>
                    {geomDraft.map((p, i) => { const q = toPx(p); return <circle key={i} cx={q.x} cy={q.y} r={3} fill="hsl(45 95% 45%)" />; })}
                    {geomDraft.length >= 2 && (
                      <polyline
                        points={geomDraft.map((p) => { const q = toPx(p); return `${q.x},${q.y}`; }).join(" ")}
                        fill="none" stroke="hsl(45 95% 45%)" strokeDasharray="4 3" strokeWidth={1.25} />
                    )}
                  </g>
                )}

                {/* Overlays */}
                {overlays.map((o) => (
                  <OverlayNode
                    key={o.id}
                    overlay={o}
                    ink={ink}
                    toPx={toPx}
                    sq={SQ}
                    unitsPerSquareX={a.unitsPerSquareX}
                    unitsPerSquareY={a.unitsPerSquareY}
                    selected={selectedOverlayId === o.id}
                    onSelect={() => setSelectedOverlayId(o.id)}
                    onChange={(patch) => updateOverlay(o.id, patch)}
                    onDelete={() => deleteOverlay(o.id)}
                    onDragStart={() => { overlayDragRef.current = { id: o.id }; draggingRef.current = "overlay"; }}
                  />
                ))}

                {/* Cursor marker */}
                {mode === "cursor" && cursorPx && (
                  <g pointerEvents="none">
                    <line x1={cursorPx.x - 10} y1={cursorPx.y} x2={cursorPx.x + 10} y2={cursorPx.y} stroke="hsl(45 95% 45%)" strokeWidth={2} />
                    <line x1={cursorPx.x} y1={cursorPx.y - 10} x2={cursorPx.x} y2={cursorPx.y + 10} stroke="hsl(45 95% 45%)" strokeWidth={2} />
                    <circle cx={cursorPx.x} cy={cursorPx.y} r={3} fill="hsl(45 95% 45%)" />
                  </g>
                )}
              </svg>
            </div>

            {/* Right column: expand right */}
            <div className="flex flex-col justify-center gap-1 pl-1">
              <EdgeButton onClick={() => expand("right")} title="Add 1 cm on the right"><Plus className="h-3 w-3" /></EdgeButton>
              <EdgeButton onClick={() => trim("right")} disabled={!canTrim("right")} title="Trim right column"><Minus className="h-3 w-3" /></EdgeButton>
            </div>
          </div>

          {/* Bottom row: expand down */}
          <div className="flex justify-center pt-1">
            <EdgeButton onClick={() => expand("bottom")} title="Add 1 cm below"><Plus className="h-3 w-3" /></EdgeButton>
            <EdgeButton onClick={() => trim("bottom")} disabled={!canTrim("bottom")} title="Trim bottom row"><Minus className="h-3 w-3" /></EdgeButton>
          </div>
        </div>
      </div>

        {/* Object resize handles — only the graph resizes, never the notebook. */}
        {active && (
          <>
            <ResizeHandle pos="nw" onPointerDown={startResize("nw")} />
            <ResizeHandle pos="ne" onPointerDown={startResize("ne")} />
            <ResizeHandle pos="sw" onPointerDown={startResize("sw")} />
            <ResizeHandle pos="se" onPointerDown={startResize("se")} />
            <ResizeHandle pos="e" onPointerDown={startResize("e")} />
            <ResizeHandle pos="s" onPointerDown={startResize("s")} />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/** Corner / edge grips shown while the graph object is selected. */
function ResizeHandle({
  pos, onPointerDown,
}: { pos: "nw" | "ne" | "sw" | "se" | "e" | "s"; onPointerDown: (e: React.PointerEvent) => void }) {
  const base = "absolute z-20 rounded-sm border border-yellow-500 bg-white";
  const map: Record<string, string> = {
    nw: "-top-1.5 -left-1.5 h-3 w-3 cursor-nwse-resize",
    ne: "-top-1.5 -right-1.5 h-3 w-3 cursor-nesw-resize",
    sw: "-bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize",
    se: "-bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize",
    e: "top-1/2 -right-1.5 h-6 w-3 -translate-y-1/2 cursor-ew-resize",
    s: "-bottom-1.5 left-1/2 h-3 w-6 -translate-x-1/2 cursor-ns-resize",
  };
  return <div className={cn(base, map[pos])} onPointerDown={onPointerDown} />;
}

// ---------- Overlay ---------------------------------------------------------

function OverlayNode({
  overlay: o, toPx, sq: SQ, unitsPerSquareX, unitsPerSquareY,
  selected, onSelect, onChange, onDelete, onDragStart, ink,
}: {
  overlay: GraphOverlay;
  ink: GraphInk;
  toPx: (p: { x: number; y: number }) => { x: number; y: number };
  sq: number;
  unitsPerSquareX: number;
  unitsPerSquareY: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<GraphOverlay>) => void;
  onDelete: () => void;
  onDragStart: () => void;
}) {
  const pos = toPx(o);
  const wPx = ((o.w ?? 2 * unitsPerSquareX) / unitsPerSquareX) * SQ;
  const hPx = ((o.h ?? 2 * unitsPerSquareY) / unitsPerSquareY) * SQ;

  const stroke = ink.ink;
  const selectRing = selected ? "hsl(45 95% 45%)" : "transparent";

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    onDragStart();
  };

  let body: React.ReactNode = null;
  if (o.kind === "text") {
    body = (
      <foreignObject x={pos.x} y={pos.y - 10} width={Math.max(60, wPx || 100)} height={Math.max(24, hPx || 28)}>
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onChange({ payload: { ...(o.payload ?? {}), text: e.currentTarget.textContent ?? "" } })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="text-[13px] text-neutral-900 outline-hidden px-1 bg-white/70 rounded"
          style={{ minHeight: 20 }}
        >
          {String((o.payload as { text?: string })?.text ?? "")}
        </div>
      </foreignObject>
    );
  } else if (o.kind === "formula") {
    body = (
      <foreignObject x={pos.x} y={pos.y - 10} width={Math.max(80, wPx || 140)} height={Math.max(24, hPx || 28)}>
        <input
          value={String((o.payload as { latex?: string })?.latex ?? "")}
          onChange={(e) => onChange({ payload: { ...(o.payload ?? {}), latex: e.target.value } })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="text-[13px] font-serif italic text-neutral-900 outline-hidden px-1 bg-white/70 rounded w-full"
        />
      </foreignObject>
    );
  } else if (o.kind === "triangle") {
    const x = pos.x, y = pos.y;
    body = <polygon points={`${x},${y - hPx / 2} ${x - wPx / 2},${y + hPx / 2} ${x + wPx / 2},${y + hPx / 2}`}
      fill={ink.wash} stroke={stroke} strokeWidth={1.5} />;
  } else if (o.kind === "rectangle") {
    body = <rect x={pos.x - wPx / 2} y={pos.y - hPx / 2} width={wPx} height={hPx}
      fill={ink.wash} stroke={stroke} strokeWidth={1.5} />;
  } else if (o.kind === "circle") {
    body = <ellipse cx={pos.x} cy={pos.y} rx={wPx / 2} ry={hPx / 2}
      fill={ink.wash} stroke={stroke} strokeWidth={1.5} />;
  } else if (o.kind === "angle") {
    const deg = Number((o.payload as { degrees?: number })?.degrees ?? 45);
    const r = Math.min(wPx, hPx) / 2;
    const rad = (deg * Math.PI) / 180;
    const ax = pos.x + r, ay = pos.y;
    const bx = pos.x + r * Math.cos(-rad), by = pos.y + r * Math.sin(-rad);
    body = (
      <g>
        <line x1={pos.x} y1={pos.y} x2={ax} y2={ay} stroke={stroke} strokeWidth={1.5} />
        <line x1={pos.x} y1={pos.y} x2={bx} y2={by} stroke={stroke} strokeWidth={1.5} />
        <path d={`M ${pos.x + r / 2} ${pos.y} A ${r / 2} ${r / 2} 0 0 0 ${pos.x + (r / 2) * Math.cos(-rad)} ${pos.y + (r / 2) * Math.sin(-rad)}`}
          fill="none" stroke={stroke} strokeWidth={1} />
        <text x={pos.x + r * 0.7 * Math.cos(-rad / 2)} y={pos.y + r * 0.7 * Math.sin(-rad / 2)} fontSize="10" fill={stroke}>{deg}°</text>
      </g>
    );
  } else if (o.kind === "image") {
    const src = String((o.payload as { src?: string })?.src ?? "");
    body = src
      ? <image href={src} x={pos.x - wPx / 2} y={pos.y - hPx / 2} width={wPx} height={hPx} />
      : (
        <foreignObject x={pos.x - wPx / 2} y={pos.y - hPx / 2} width={wPx} height={hPx}>
          <div
            className="w-full h-full border border-dashed border-neutral-400 bg-neutral-50 flex items-center justify-center text-[11px] text-neutral-500"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="cursor-pointer px-2 py-1 rounded bg-white border border-neutral-200 hover:bg-neutral-50">
              Choose image
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => onChange({ payload: { src: String(reader.result ?? "") } });
                  reader.readAsDataURL(f);
                }}
              />
            </label>
          </div>
        </foreignObject>
      );
  }

  // Bounding box for selection ring + drag handle
  const bx = pos.x - wPx / 2, by = pos.y - hPx / 2;
  const rectW = ["text", "formula"].includes(o.kind) ? Math.max(60, wPx || 100) : wPx;
  const rectH = ["text", "formula"].includes(o.kind) ? Math.max(24, hPx || 28) : hPx;
  const rx = ["text", "formula"].includes(o.kind) ? pos.x : bx;
  const ry = ["text", "formula"].includes(o.kind) ? pos.y - 10 : by;

  return (
    <g>
      {body}
      <rect
        x={rx - 3} y={ry - 3} width={rectW + 6} height={rectH + 6}
        fill="transparent"
        stroke={selectRing}
        strokeDasharray={selected ? "4 3" : undefined}
        strokeWidth={1}
        onMouseDown={handleMouseDown}
        style={{ cursor: "move" }}
      />
      {selected && (
        <g transform={`translate(${rx + rectW - 4}, ${ry - 12})`} style={{ cursor: "pointer" }}
          onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}>
          <circle r={8} fill="white" stroke="hsl(0 70% 55%)" />
          <text textAnchor="middle" dy={3} fontSize="11" fill="hsl(0 70% 55%)">×</text>
        </g>
      )}
    </g>
  );
}

// ---------- Small presentational helpers ------------------------------------

function ShapeNode({
  shape, toPx, ink,
}: {
  shape: GraphShape;
  toPx: (p: { x: number; y: number }) => { x: number; y: number };
  ink: GraphInk;
}) {
  const stroke = ink.ink;
  const fill = "none";
  const pts = shape.pts.map(toPx);
  if (shape.kind === "point" && pts[0]) {
    return <circle cx={pts[0].x} cy={pts[0].y} r={4} fill={stroke} />;
  }
  if (shape.kind === "line" && pts.length >= 2) {
    return <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={stroke} strokeWidth={1.5} />;
  }
  if (shape.kind === "circle" && pts.length >= 2) {
    const [c, r] = pts;
    const radius = Math.hypot(r.x - c.x, r.y - c.y);
    return <circle cx={c.x} cy={c.y} r={radius} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  }
  if (shape.kind === "arc" && pts.length >= 3) {
    const d = `M ${pts[0].x} ${pts[0].y} Q ${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y}`;
    return <path d={d} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  }
  if (shape.kind === "polygon" && pts.length >= 2) {
    return (
      <polygon
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill={ink.wash} stroke={stroke} strokeWidth={1.5}
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

function EdgeButton({
  onClick, disabled, title, children,
}: { onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title}
      className={cn(
        "h-6 w-6 inline-flex items-center justify-center rounded border transition-colors",
        disabled
          ? "border-neutral-100 bg-neutral-50 text-neutral-300 cursor-not-allowed"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-yellow-50 hover:border-yellow-400",
      )}
    >{children}</button>
  );
}

function InsertRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-neutral-700 hover:bg-neutral-50"
    >
      <span className="w-4 inline-flex justify-center">{icon}</span>
      {label}
    </button>
  );
}

function round(v: number) { return Math.round(v * 100) / 100; }

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
