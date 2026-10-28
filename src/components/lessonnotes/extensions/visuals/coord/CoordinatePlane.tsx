import type { JSX } from "react";
// Smart Coordinate Plane — interactive SVG board. Handles world↔screen
// transform, grid/axes rendering for every mode, component rendering,
// pointer drag with grid snap, and a lightweight pick tool for creating
// new components. Chrome + edit panel live in CoordinatePanel.tsx.

import { useMemo, useRef, useState, useCallback } from "react";
import { CoordinatePanel } from "./CoordinatePanel";
import {
  compileFn,
  defaultAttrs,
  displayName,
  newId,
  nextPointName,
  type CoordComponent,
  type CoordDisplay,
  type CoordMode,
  type CoordPlaneAttrs,
  type CoordPoint,
  type CoordView,
} from "./components";

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected: boolean;
}

const WIDTH = 520;
const HEIGHT = 400;
const PAD = 24;

export function CoordinatePlane({ attrs, onChange, selected }: Props) {
  const data = normalizeAttrs(attrs);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pickMode, setPickMode] = useState<null | {
    kind: CoordComponent["kind"] | "vector" | "point";
    curveKind?: string;
    needed: number;
    picked: string[];
  }>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ name: string; startX: number; startY: number } | null>(null);

  const { toScreen, toWorld, snap } = useMemo(
    () => makeTransform(data.view, data.display.snap),
    [data.view, data.display.snap]
  );

  const patch = useCallback((p: Partial<CoordPlaneAttrs>) => onChange(p as any), [onChange]);
  const setPoints = (points: Record<string, CoordPoint>) => patch({ points });
  const setComponents = (components: CoordComponent[]) => patch({ components });
  const setSelected = (id: string | null) => patch({ selectedId: id });

  // ── pointer handling ───────────────────────────────────────────────────
  const svgPoint = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    const local = ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    return toWorld(local.x, local.y);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!pickMode) { setSelected(null); return; }
    const w = svgPoint(e);
    const s = snap(w);
    // create a new point at click
    const name = nextPointName(new Set(Object.keys(data.points)));
    const nextPoints = { ...data.points, [name]: { x: s.x, y: s.y } };
    const picked = [...pickMode.picked, name];
    if (picked.length >= pickMode.needed) {
      const comp = buildComponent(pickMode.kind, pickMode.curveKind, picked);
      setPoints(nextPoints);
      setComponents([...data.components, comp]);
      setPickMode(null);
      setSelected(comp.id);
    } else {
      setPoints(nextPoints);
      setPickMode({ ...pickMode, picked });
    }
  };

  const handlePointDown = (name: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const p = data.points[name];
    if (!p || p.locked) return;
    dragRef.current = { name, startX: p.x, startY: p.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const handlePointMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const w = svgPoint(e);
    const s = snap(w);
    const { name } = dragRef.current;
    setPoints({ ...data.points, [name]: { ...data.points[name], x: s.x, y: s.y } });
  };
  const handlePointUp = () => { dragRef.current = null; };

  // ── rendering ──────────────────────────────────────────────────────────
  const bg = data.display.bgColor === "transparent" ? undefined : data.display.bgColor;

  return (
    <div className="relative inline-block" onMouseDown={(e) => e.stopPropagation()}>
      {(selected || panelOpen) && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="absolute -top-7 left-1/2 -translate-x-1/2 z-10 rounded-full bg-primary text-primary-foreground text-[10px] font-medium px-2.5 py-0.5 shadow-md"
        >
          ⚙ Edit
        </button>
      )}
      {pickMode && (
        <div className="absolute -top-7 right-0 z-10 rounded-full bg-amber-500 text-white text-[10px] px-2.5 py-0.5 shadow-md">
          Click {pickMode.needed - pickMode.picked.length} more point{pickMode.needed - pickMode.picked.length === 1 ? "" : "s"}
          <button className="ml-2 underline" onClick={() => setPickMode(null)}>cancel</button>
        </div>
      )}
      <svg
        ref={svgRef}
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block"
        style={{ background: bg, cursor: pickMode ? "crosshair" : "default" }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointMove}
        onPointerUp={handlePointUp}
      >
        <Grid mode={data.mode} view={data.view} display={data.display} toScreen={toScreen} />
        {data.mode === "cartesian4" || data.mode === "cartesian1" || data.mode === "complex"
          ? <Axes mode={data.mode} view={data.view} display={data.display} toScreen={toScreen} />
          : null}

        {/* components (sorted by layer) */}
        {[...data.components]
          .sort((a, b) => (a.behaviour?.layer ?? 0) - (b.behaviour?.layer ?? 0))
          .filter(c => c.behaviour?.visible !== false)
          .map(c => (
            <ComponentView
              key={c.id}
              c={c}
              points={data.points}
              view={data.view}
              toScreen={toScreen}
              selected={data.selectedId === c.id}
              onSelect={() => setSelected(c.id)}
            />
          ))}

        {/* points on top */}
        {Object.entries(data.points).map(([name, p]) =>
          p.hidden ? null : (
            <PointView
              key={name}
              name={name}
              p={p}
              toScreen={toScreen}
              onPointerDown={handlePointDown(name)}
              selected={data.selectedId === name}
              onSelect={() => setSelected(name)}
            />
          )
        )}
      </svg>

      <CoordinatePanel
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setPickMode(null); }}
        attrs={data}
        onPatch={patch}
        onRequestPick={(kind, needed, curveKind) => {
          if (needed === 0) {
            const comp = buildComponent(kind, curveKind, []);
            setComponents([...data.components, comp]);
            setSelected(comp.id);
            return;
          }
          setPickMode({ kind: kind as any, needed, picked: [], curveKind });
        }}

        pickMode={pickMode}
      />
    </div>
  );
}

// ── transform ────────────────────────────────────────────────────────────
function makeTransform(view: CoordView, snapOn: boolean) {
  const w = WIDTH - PAD * 2;
  const h = HEIGHT - PAD * 2;
  const sx = w / (view.xMax - view.xMin);
  const sy = h / (view.yMax - view.yMin);
  const s = view.equalScale ? Math.min(sx, sy) : null;
  const kx = s ?? sx; const ky = s ?? sy;
  const originX = PAD + (0 - view.xMin) * kx;
  const originY = HEIGHT - PAD - (0 - view.yMin) * ky;
  const toScreen = (x: number, y: number) => ({
    x: originX + x * kx,
    y: originY - y * ky,
  });
  const toWorld = (X: number, Y: number) => ({
    x: (X - originX) / kx,
    y: (originY - Y) / ky,
  });
  const step = view.gridStep || 1;
  const snap = (p: { x: number; y: number }) =>
    snapOn ? { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step } : p;
  return { toScreen, toWorld, snap };
}

// ── grid + axes ──────────────────────────────────────────────────────────
function Grid({ mode, view, display, toScreen }: {
  mode: CoordMode; view: CoordView; display: CoordDisplay;
  toScreen: (x: number, y: number) => { x: number; y: number };
}) {
  if (!display.showGrid) return null;
  const step = view.gridStep || 1;
  const lines: JSX.Element[] = [];

  if (mode === "polar") {
    const c = toScreen(0, 0);
    const maxR = Math.max(Math.abs(view.xMax), Math.abs(view.xMin), Math.abs(view.yMax), Math.abs(view.yMin));
    for (let r = step; r <= maxR + 0.001; r += step) {
      const p = toScreen(r, 0);
      const rad = Math.hypot(p.x - c.x, p.y - c.y);
      lines.push(<circle key={`r${r}`} cx={c.x} cy={c.y} r={rad} fill="none" stroke={display.gridColor} strokeWidth={0.5} />);
    }
    for (let a = 0; a < 12; a++) {
      const ang = (a * Math.PI) / 6;
      const p = toScreen(maxR * Math.cos(ang), maxR * Math.sin(ang));
      lines.push(<line key={`a${a}`} x1={c.x} y1={c.y} x2={p.x} y2={p.y} stroke={display.gridColor} strokeWidth={0.5} />);
    }
    return <g>{lines}</g>;
  }

  if (mode === "isometric") {
    const dots: JSX.Element[] = [];
    for (let x = Math.ceil(view.xMin); x <= view.xMax; x += step) {
      for (let y = Math.ceil(view.yMin); y <= view.yMax; y += step) {
        const off = (Math.abs(y) % 2) * 0.5 * step;
        const p = toScreen(x + off, y);
        dots.push(<circle key={`d${x},${y}`} cx={p.x} cy={p.y} r={0.9} fill={display.gridColor} />);
      }
    }
    return <g>{dots}</g>;
  }

  if (mode === "dot") {
    const dots: JSX.Element[] = [];
    for (let x = Math.ceil(view.xMin); x <= view.xMax; x += step) {
      for (let y = Math.ceil(view.yMin); y <= view.yMax; y += step) {
        const p = toScreen(x, y);
        dots.push(<circle key={`d${x},${y}`} cx={p.x} cy={p.y} r={0.9} fill={display.gridColor} />);
      }
    }
    return <g>{dots}</g>;
  }

  // cartesian / complex
  const xStart = mode === "cartesian1" ? Math.max(0, view.xMin) : view.xMin;
  const yStart = mode === "cartesian1" ? Math.max(0, view.yMin) : view.yMin;
  for (let x = Math.ceil(xStart); x <= view.xMax; x += step) {
    const a = toScreen(x, view.yMin); const b = toScreen(x, view.yMax);
    lines.push(<line key={`vx${x}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={display.gridColor} strokeWidth={x === 0 ? 0 : 0.5} />);
  }
  for (let y = Math.ceil(yStart); y <= view.yMax; y += step) {
    const a = toScreen(view.xMin, y); const b = toScreen(view.xMax, y);
    lines.push(<line key={`vy${y}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={display.gridColor} strokeWidth={y === 0 ? 0 : 0.5} />);
  }
  return <g>{lines}</g>;
}

function Axes({ mode, view, display, toScreen }: {
  mode: CoordMode; view: CoordView; display: CoordDisplay;
  toScreen: (x: number, y: number) => { x: number; y: number };
}) {
  if (!display.showAxes) return null;
  const step = view.gridStep || 1;
  const xLabel = mode === "complex" ? "Re" : "x";
  const yLabel = mode === "complex" ? "Im" : "y";
  const xStart = mode === "cartesian1" ? 0 : view.xMin;
  const yStart = mode === "cartesian1" ? 0 : view.yMin;

  const xAxis = toScreen(0, 0);
  const p0 = toScreen(view.xMin, 0);
  const p1 = toScreen(view.xMax, 0);
  const q0 = toScreen(0, view.yMin);
  const q1 = toScreen(0, view.yMax);

  const nums: JSX.Element[] = [];
  if (display.showNumbers) {
    for (let x = Math.ceil(xStart); x <= view.xMax; x += step) {
      if (x === 0) continue;
      const p = toScreen(x, 0);
      nums.push(<text key={`nx${x}`} x={p.x} y={p.y + 12} textAnchor="middle" fontSize={9} fill={display.axisColor}>{x}</text>);
    }
    for (let y = Math.ceil(yStart); y <= view.yMax; y += step) {
      if (y === 0) continue;
      const p = toScreen(0, y);
      nums.push(<text key={`ny${y}`} x={p.x - 5} y={p.y + 3} textAnchor="end" fontSize={9} fill={display.axisColor}>{y}</text>);
    }
  }

  return (
    <g>
      <line x1={mode === "cartesian1" ? xAxis.x : p0.x} y1={xAxis.y} x2={p1.x} y2={xAxis.y} stroke={display.axisColor} strokeWidth={1} markerEnd="url(#coord-arrow)" />
      <line x1={xAxis.x} y1={mode === "cartesian1" ? xAxis.y : q0.y} x2={xAxis.x} y2={q1.y} stroke={display.axisColor} strokeWidth={1} markerEnd="url(#coord-arrow)" />
      <defs>
        <marker id="coord-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill={display.axisColor} />
        </marker>
      </defs>
      <text x={p1.x + 4} y={xAxis.y + 3} fontSize={11} fontStyle="italic" fill={display.axisColor}>{xLabel}</text>
      <text x={xAxis.x + 4} y={q1.y - 2} fontSize={11} fontStyle="italic" fill={display.axisColor}>{yLabel}</text>
      {nums}
    </g>
  );
}

// ── points + components ──────────────────────────────────────────────────
function PointView({ name, p, toScreen, onPointerDown, selected, onSelect }: {
  name: string; p: CoordPoint; toScreen: (x: number, y: number) => { x: number; y: number };
  onPointerDown: (e: React.PointerEvent) => void;
  selected: boolean; onSelect: () => void;
}) {
  const s = toScreen(p.x, p.y);
  return (
    <g style={{ cursor: p.locked ? "not-allowed" : "grab" }}
       onPointerDown={(e) => { onSelect(); onPointerDown(e); }}>
      <circle cx={s.x} cy={s.y} r={selected ? 5 : 3.5} fill="hsl(var(--primary))" stroke="white" strokeWidth={1} />
      {!p.labelHidden && (
        <text x={s.x + 6} y={s.y - 6} fontSize={11} fontWeight={600} fill="currentColor">{name}</text>
      )}
    </g>
  );
}

function ComponentView({ c, points, view, toScreen, selected, onSelect }: {
  c: CoordComponent;
  points: Record<string, CoordPoint>;
  view: CoordView;
  toScreen: (x: number, y: number) => { x: number; y: number };
  selected: boolean;
  onSelect: () => void;
}) {
  const color = c.appearance?.color ?? "hsl(var(--primary))";
  const width = c.appearance?.thickness ?? 2;
  const dash = c.appearance?.dash === "dashed" ? "6 4"
             : c.appearance?.dash === "dotted" ? "2 3" : undefined;
  const opacity = c.appearance?.opacity ?? 1;
  const glow = selected ? { filter: "drop-shadow(0 0 3px hsl(var(--primary)))" } : {};

  const commonProps = { stroke: color, strokeWidth: width, strokeDasharray: dash, opacity, fill: "none", style: glow as any, onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); onSelect(); }, cursor: "pointer" as const };

  const pt = (n: string) => points[n];

  switch (c.kind) {
    case "segment": {
      const A = pt(c.nodes![0]); const B = pt(c.nodes![1]);
      if (!A || !B) return null;
      const a = toScreen(A.x, A.y); const b = toScreen(B.x, B.y);
      const arrow = c.appearance?.arrow;
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            markerEnd={arrow === "end" || arrow === "both" ? "url(#coord-arrow)" : undefined}
            markerStart={arrow === "both" ? "url(#coord-arrow)" : undefined}
            {...commonProps} />
          {c.content?.showLength && (
            <text x={(a.x + b.x) / 2 + 6} y={(a.y + b.y) / 2 - 6} fontSize={10} fill={color}>
              {Math.hypot(B.x - A.x, B.y - A.y).toFixed(2)}
            </text>
          )}
        </g>
      );
    }
    case "ray": {
      const A = pt(c.nodes![0]); const B = pt(c.nodes![1]);
      if (!A || !B) return null;
      const dx = B.x - A.x, dy = B.y - A.y;
      const t = 100 / Math.hypot(dx, dy);
      const far = { x: A.x + dx * t, y: A.y + dy * t };
      const a = toScreen(A.x, A.y); const f = toScreen(far.x, far.y);
      return <line x1={a.x} y1={a.y} x2={f.x} y2={f.y} markerEnd="url(#coord-arrow)" {...commonProps} />;
    }
    case "line": {
      const A = pt(c.nodes![0]); const B = pt(c.nodes![1]);
      if (!A || !B) return null;
      const dx = B.x - A.x, dy = B.y - A.y;
      const t = 200 / Math.hypot(dx, dy);
      const p1 = { x: A.x - dx * t, y: A.y - dy * t };
      const p2 = { x: A.x + dx * t, y: A.y + dy * t };
      const a = toScreen(p1.x, p1.y); const b = toScreen(p2.x, p2.y);
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...commonProps} />;
    }
    case "vector": {
      const A = pt(c.nodes![0]); const B = pt(c.nodes![1]);
      if (!A || !B) return null;
      const a = toScreen(A.x, A.y); const b = toScreen(B.x, B.y);
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd="url(#coord-arrow)" {...commonProps} />;
    }
    case "polygon": {
      const pts = (c.nodes ?? []).map(n => pt(n)).filter(Boolean) as CoordPoint[];
      if (pts.length < 3) return null;
      const d = pts.map(p => toScreen(p.x, p.y)).map(s => `${s.x},${s.y}`).join(" ");
      return <polygon points={d} {...commonProps} fill={c.appearance?.fill ?? "none"} />;
    }
    case "circle": {
      const C = pt(c.nodes![0]); const R = pt(c.nodes![1]);
      if (!C || !R) return null;
      const cs = toScreen(C.x, C.y); const rs = toScreen(R.x, R.y);
      const r = Math.hypot(rs.x - cs.x, rs.y - cs.y);
      return <circle cx={cs.x} cy={cs.y} r={r} {...commonProps} fill={c.appearance?.fill ?? "none"} />;
    }
    case "arc": {
      const C = pt(c.nodes![0]); const A = pt(c.nodes![1]); const B = pt(c.nodes![2]);
      if (!C || !A || !B) return null;
      const rW = Math.hypot(A.x - C.x, A.y - C.y);
      const a1 = Math.atan2(A.y - C.y, A.x - C.x);
      const a2 = Math.atan2(B.y - C.y, B.x - C.x);
      const start = toScreen(C.x + rW * Math.cos(a1), C.y + rW * Math.sin(a1));
      const end   = toScreen(C.x + rW * Math.cos(a2), C.y + rW * Math.sin(a2));
      const cs    = toScreen(C.x, C.y);
      const r = Math.hypot(start.x - cs.x, start.y - cs.y);
      const large = Math.abs(a2 - a1) > Math.PI ? 1 : 0;
      const sweep = a2 > a1 ? 0 : 1;
      return <path d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y}`} {...commonProps} />;
    }
    case "curve": {
      const cv = c.curve!;
      const src = curveExpression(cv);
      const fn = compileFn(src);
      if (!fn) return null;
      const N = 240;
      const pts: string[] = [];
      let broken = true;
      for (let i = 0; i <= N; i++) {
        const x = view.xMin + ((view.xMax - view.xMin) * i) / N;
        const y = fn(x);
        if (!Number.isFinite(y)) { broken = true; continue; }
        const s = toScreen(x, y);
        if (s.y < -1000 || s.y > 1500) { broken = true; continue; }
        pts.push(`${broken ? "M" : "L"} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`);
        broken = false;
      }
      return <path d={pts.join(" ")} {...commonProps} />;
    }
    case "label": {
      const A = pt(c.nodes?.[0] ?? "");
      const anchor = A ? toScreen(A.x, A.y) : toScreen(0, 0);
      return <text x={anchor.x + 6} y={anchor.y - 6} fontSize={12} fill={color} onPointerDown={(e) => { e.stopPropagation(); onSelect(); }} style={{ cursor: "pointer" }}>{c.content?.label ?? "Label"}</text>;
    }
    case "angleMark": {
      const A = pt(c.nodes![0]); const V = pt(c.nodes![1]); const B = pt(c.nodes![2]);
      if (!A || !V || !B) return null;
      const a1 = Math.atan2(A.y - V.y, A.x - V.x);
      const a2 = Math.atan2(B.y - V.y, B.x - V.x);
      const vs = toScreen(V.x, V.y);
      const r = 20;
      const s1 = { x: vs.x + r * Math.cos(-a1), y: vs.y + r * Math.sin(-a1) };
      const s2 = { x: vs.x + r * Math.cos(-a2), y: vs.y + r * Math.sin(-a2) };
      const large = Math.abs(a2 - a1) > Math.PI ? 1 : 0;
      return <path d={`M ${s1.x} ${s1.y} A ${r} ${r} 0 ${large} 0 ${s2.x} ${s2.y}`} {...commonProps} />;
    }
    case "point":
    default:
      return null;
  }
}

function curveExpression(cv: NonNullable<CoordComponent["curve"]>): string {
  switch (cv.kind) {
    case "fn":          return cv.expr ?? "x";
    case "sine":        return `${cv.a ?? 1}*sin(${cv.b ?? 1}*x)`;
    case "cosine":      return `${cv.a ?? 1}*cos(${cv.b ?? 1}*x)`;
    case "tangent":     return `${cv.a ?? 1}*tan(${cv.b ?? 1}*x)`;
    case "parabola":    return `${cv.a ?? 1}*x^2 + ${cv.b ?? 0}*x + ${cv.c ?? 0}`;
    case "cubic":       return `${cv.a ?? 1}*x^3 + ${cv.b ?? 0}*x + ${cv.c ?? 0}`;
    case "exponential": return `${cv.a ?? 1}*exp(${cv.b ?? 1}*x)`;
    case "log":         return `${cv.a ?? 1}*ln(x)`;
    case "abs":         return `${cv.a ?? 1}*abs(x)`;
    case "circleEq":    return `sqrt((${cv.r ?? 3})^2 - (x-(${cv.h ?? 0}))^2) + (${cv.k ?? 0})`;
  }
}

function buildComponent(kind: string, curveKind: string | undefined, nodes: string[]): CoordComponent {
  const base: CoordComponent = {
    id: newId(kind[0]),
    kind: kind as CoordComponent["kind"],
    nodes,
    appearance: { color: "hsl(var(--primary))", thickness: 2, dash: "solid" },
    behaviour: { visible: true, locked: false, layer: 0 },
    content: { showLabel: true },
  };
  if (kind === "vector") base.appearance!.arrow = "end";
  if (kind === "curve") base.curve = { kind: (curveKind as any) ?? "fn", expr: "x^2" };
  return base;
}

// Normalise partial attrs from persisted docs to a fully-shaped object.
function normalizeAttrs(a: Record<string, unknown>): CoordPlaneAttrs {
  const d = defaultAttrs();
  return {
    ...d,
    ...(a as any),
    view: { ...d.view, ...((a as any).view ?? {}) },
    display: { ...d.display, ...((a as any).display ?? {}) },
    points: (a as any).points ?? {},
    components: Array.isArray((a as any).components) ? (a as any).components : [],
  };
}
