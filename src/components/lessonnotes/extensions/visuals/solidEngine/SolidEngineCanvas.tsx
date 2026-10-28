// SolidEngineCanvas — SVG renderer for the Universal 3D Solid Engine.
// Polygonal solids use projection.ts; curved solids (cylinder/cone/
// sphere/hemisphere) render analytically. Drag on the body moves the
// solid; corner handles resize; rotation is driven from the panel.

import { useEffect, useRef, useState } from "react";
import type { UCESolid, UCESolidModel } from "./types";
import { MEASUREMENT_LETTER } from "./types";
import { projectSolid, rotate } from "./projection";

interface Props {
  model: UCESolidModel;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  onChange: (m: UCESolidModel) => void;
  editable: boolean;
}

type Drag =
  | { kind: "move"; id: string; ox: number; oy: number }
  | { kind: "resize"; id: string; startW: number; startH: number; startD: number; px: number; py: number }
  | { kind: "rotate"; id: string; startRotY: number; startRotX: number; px: number; py: number };

export function SolidEngineCanvas({ model, selection, onSelectionChange, onChange, editable }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const modelRef = useRef(model);
  const onChangeRef = useRef(onChange);
  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const clientToSvg = (cx: number, cy: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: cx, y: cy };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const beginDrag = (e: React.PointerEvent, drag: Drag) => {
    if (!editable) return;
    e.stopPropagation();
    const s = model.solids.find((s) => s.id === drag.id);
    if (s?.locked) return;
    dragRef.current = drag;
    setDragging(true);
    if (!selection.includes(drag.id)) onSelectionChange([drag.id]);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = clientToSvg(ev.clientX, ev.clientY);
      const m = modelRef.current;
      const solids = m.solids.map((s) => {
        if (s.id !== d.id) return s;
        if (d.kind === "move") {
          const dx = p.x - d.ox, dy = p.y - d.oy;
          dragRef.current = { ...d, ox: p.x, oy: p.y };
          return { ...s, x: s.x + dx, y: s.y + dy };
        }
        if (d.kind === "resize") {
          const dx = p.x - d.px;
          const dy = p.y - d.py;
          const scale = 1 + (dx + -dy) / 100;
          const k = Math.max(0.2, scale);
          return { ...s, width: d.startW * k, height: d.startH * k, depth: d.startD * k };
        }
        if (d.kind === "rotate") {
          const dx = p.x - d.px;
          const dy = p.y - d.py;
          return { ...s, rotY: d.startRotY + dx, rotX: d.startRotX - dy };
        }
        return s;
      });
      onChangeRef.current({ ...m, solids });
    };
    const up = () => { dragRef.current = null; setDragging(false); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${model.width} ${model.height}`}
      width={model.width}
      height={model.height}
      onPointerDown={(e) => {
        if (e.target === svgRef.current) onSelectionChange([]);
      }}
      style={{ display: "block", touchAction: "none", userSelect: "none", overflow: "visible" }}
    >
      {model.solids.map((s) => (
        <SolidGroup
          key={s.id}
          solid={s}
          selected={selection.includes(s.id)}
          editable={editable}
          onBodyDown={(e) => {
            const p = clientToSvg(e.clientX, e.clientY);
            beginDrag(e, { kind: "move", id: s.id, ox: p.x, oy: p.y });
          }}
          onResizeDown={(e) => {
            const p = clientToSvg(e.clientX, e.clientY);
            beginDrag(e, {
              kind: "resize", id: s.id,
              startW: s.width, startH: s.height, startD: s.depth,
              px: p.x, py: p.y,
            });
          }}
          onRotateDown={(e) => {
            const p = clientToSvg(e.clientX, e.clientY);
            beginDrag(e, {
              kind: "rotate", id: s.id,
              startRotY: s.rotY, startRotX: s.rotX,
              px: p.x, py: p.y,
            });
          }}
        />
      ))}
    </svg>
  );
}

function dashFor(s: UCESolid) {
  return s.style === "dashed" ? "6 4" : s.style === "dotted" ? "1 4" : undefined;
}

function fillProps(s: UCESolid) {
  if (s.fillMode === "none") return { fill: "none" as const, fillOpacity: 0 };
  return { fill: s.fillColor, fillOpacity: s.fillMode === "solid" ? 1 : s.fillOpacity };
}

interface GroupProps {
  solid: UCESolid;
  selected: boolean;
  editable: boolean;
  onBodyDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent) => void;
  onRotateDown: (e: React.PointerEvent) => void;
}

function SolidGroup({ solid: s, selected, editable, onBodyDown, onResizeDown, onRotateDown }: GroupProps) {
  const isCurved = s.type === "cylinder" || s.type === "cone" || s.type === "sphere" || s.type === "hemisphere";
  const body = isCurved ? renderCurved(s, onBodyDown) : renderPolygonal(s, onBodyDown);

  // handle positions from a bounding-box approximation
  const bbox = boundingBox(s);
  const cornerX = bbox.x + bbox.w + 6;
  const cornerY = bbox.y + bbox.h + 6;
  const rotX = bbox.x + bbox.w + 6;
  const rotY = bbox.y - 6;

  return (
    <g>
      {body}

      {/* labels */}
      {s.labels.map((lab) => (
        <text key={lab.id} x={s.x + lab.dx} y={s.y + lab.dy}
          fontSize={12} fill={s.color} textAnchor="middle" pointerEvents="none">
          {lab.text}
        </text>
      ))}

      {/* measurements (simple heuristic overlays) */}
      {renderMeasurements(s)}

      {selected && editable && (
        <>
          <rect x={bbox.x - 4} y={bbox.y - 4} width={bbox.w + 8} height={bbox.h + 8}
            fill="none" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="3 3"
            opacity={0.5} pointerEvents="none" />
          <Handle x={cornerX} y={cornerY} onDown={onResizeDown} title="Drag to resize" />
          <Handle x={rotX} y={rotY} onDown={onRotateDown} title="Drag to rotate" color="hsl(var(--primary))" />
        </>
      )}
    </g>
  );
}

function renderPolygonal(s: UCESolid, onBodyDown: (e: React.PointerEvent) => void) {
  const proj = projectSolid(s);
  const dash = dashFor(s);
  const fp = fillProps(s);

  // Draw visible faces (fill), then edges: hidden first, visible on top.
  const facePaths = proj.faces
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !f.hidden)
    .sort((a, b) => avgZ(proj.vertices3d, a.f.indices) - avgZ(proj.vertices3d, b.f.indices))
    .map(({ f, i }) => {
      const pts = f.indices.map((idx) => proj.vertices2d[idx]);
      const d = pts.map((p, k) => `${k === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") + " Z";
      return <path key={`f${i}`} d={d} fill={fp.fill} fillOpacity={fp.fillOpacity} stroke="none" />;
    });

  const hiddenEdges = s.hiddenEdges === "hide" ? [] : proj.edges
    .filter((e) => e.hidden)
    .map((e, i) => (
      <line key={`he${i}`} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
        stroke={s.color} strokeWidth={s.thickness}
        strokeDasharray={s.hiddenEdges === "dashed" ? "4 3" : dash}
        opacity={s.hiddenEdges === "dashed" ? 0.85 : 1}
        pointerEvents="none" />
    ));

  const visibleEdges = proj.edges
    .filter((e) => !e.hidden)
    .map((e, i) => (
      <line key={`ve${i}`} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
        stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash}
        pointerEvents="none" />
    ));

  // Grab surface = union of visible face regions (approximated with bbox rect).
  const bb = boundingBox(s);
  return (
    <g>
      <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h}
        fill="transparent" onPointerDown={onBodyDown}
        style={{ cursor: "grab" }} />
      {facePaths}
      {hiddenEdges}
      {visibleEdges}
    </g>
  );
}

function avgZ(vs: { x: number; y: number; z: number }[], idxs: number[]) {
  let z = 0;
  for (const i of idxs) z += vs[i].z;
  return z / idxs.length;
}

function renderCurved(s: UCESolid, onBodyDown: (e: React.PointerEvent) => void) {
  const dash = dashFor(s);
  const fp = fillProps(s);
  const rx = (s.width * s.size) / 2;
  const ry = (s.depth * s.size) / 2;   // radius in depth direction (for foreshortening)
  const h = s.height * s.size;

  // Foreshortened ellipse height for top/bottom caps depends on rotX.
  const capRy = Math.max(2, Math.abs(Math.sin((s.rotX * Math.PI) / 180)) * ry);

  const cx = s.x;
  const bottomY = s.y + h / 2;
  const topY = s.y - h / 2;

  if (s.type === "sphere") {
    const r = Math.min(rx, s.height * s.size / 2);
    return (
      <g>
        <circle cx={cx} cy={s.y} r={r}
          stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash}
          fill={fp.fill} fillOpacity={fp.fillOpacity}
          onPointerDown={onBodyDown}
          style={{ cursor: "grab" }} />
        {/* equator ellipse for 3D feel */}
        <ellipse cx={cx} cy={s.y} rx={r} ry={Math.max(3, capRy)}
          stroke={s.color} strokeWidth={s.thickness * 0.7}
          strokeDasharray={s.hiddenEdges === "hide" ? undefined : "4 3"}
          fill="none" opacity={0.7} pointerEvents="none" />
      </g>
    );
  }

  if (s.type === "hemisphere") {
    const r = rx;
    return (
      <g>
        <rect x={cx - r - 4} y={bottomY - r - 4} width={r * 2 + 8} height={r + 8}
          fill="transparent" onPointerDown={onBodyDown} style={{ cursor: "grab" }} />
        <path d={`M ${cx - r} ${bottomY} A ${r} ${r} 0 0 1 ${cx + r} ${bottomY}`}
          stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash}
          fill={fp.fill} fillOpacity={fp.fillOpacity} />
        <ellipse cx={cx} cy={bottomY} rx={r} ry={Math.max(3, capRy)}
          stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash}
          fill="none" />
      </g>
    );
  }

  if (s.type === "cone") {
    const apexY = topY;
    return (
      <g>
        <rect x={cx - rx - 4} y={apexY - 4} width={rx * 2 + 8} height={h + 8}
          fill="transparent" onPointerDown={onBodyDown} style={{ cursor: "grab" }} />
        {/* base fill */}
        {fp.fill !== "none" && (
          <ellipse cx={cx} cy={bottomY} rx={rx} ry={Math.max(3, capRy)}
            fill={fp.fill} fillOpacity={fp.fillOpacity} stroke="none" />
        )}
        {/* sides */}
        <line x1={cx - rx} y1={bottomY} x2={cx} y2={apexY}
          stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash} />
        <line x1={cx + rx} y1={bottomY} x2={cx} y2={apexY}
          stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash} />
        {/* base front arc */}
        <path d={`M ${cx - rx} ${bottomY} A ${rx} ${Math.max(3, capRy)} 0 0 0 ${cx + rx} ${bottomY}`}
          stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash} fill="none" />
        {/* base back arc */}
        {s.hiddenEdges !== "hide" && (
          <path d={`M ${cx - rx} ${bottomY} A ${rx} ${Math.max(3, capRy)} 0 0 1 ${cx + rx} ${bottomY}`}
            stroke={s.color} strokeWidth={s.thickness}
            strokeDasharray={s.hiddenEdges === "dashed" ? "4 3" : dash}
            fill="none" opacity={0.85} />
        )}
      </g>
    );
  }

  // cylinder
  return (
    <g>
      <rect x={cx - rx - 4} y={topY - 4} width={rx * 2 + 8} height={h + 8}
        fill="transparent" onPointerDown={onBodyDown} style={{ cursor: "grab" }} />
      {/* body fill */}
      {fp.fill !== "none" && (
        <path d={`M ${cx - rx} ${topY} L ${cx - rx} ${bottomY}
          A ${rx} ${Math.max(3, capRy)} 0 0 0 ${cx + rx} ${bottomY}
          L ${cx + rx} ${topY}
          A ${rx} ${Math.max(3, capRy)} 0 0 1 ${cx - rx} ${topY} Z`}
          fill={fp.fill} fillOpacity={fp.fillOpacity} stroke="none" />
      )}
      {/* top ellipse */}
      <ellipse cx={cx} cy={topY} rx={rx} ry={Math.max(3, capRy)}
        stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash}
        fill="none" />
      {/* side lines */}
      <line x1={cx - rx} y1={topY} x2={cx - rx} y2={bottomY}
        stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash} />
      <line x1={cx + rx} y1={topY} x2={cx + rx} y2={bottomY}
        stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash} />
      {/* bottom front arc */}
      <path d={`M ${cx - rx} ${bottomY} A ${rx} ${Math.max(3, capRy)} 0 0 0 ${cx + rx} ${bottomY}`}
        stroke={s.color} strokeWidth={s.thickness} strokeDasharray={dash} fill="none" />
      {/* bottom back arc */}
      {s.hiddenEdges !== "hide" && (
        <path d={`M ${cx - rx} ${bottomY} A ${rx} ${Math.max(3, capRy)} 0 0 1 ${cx + rx} ${bottomY}`}
          stroke={s.color} strokeWidth={s.thickness}
          strokeDasharray={s.hiddenEdges === "dashed" ? "4 3" : dash}
          fill="none" opacity={0.85} />
      )}
    </g>
  );
}

function renderMeasurements(s: UCESolid) {
  const items: React.ReactNode[] = [];
  const bb = boundingBox(s);
  const c = s.color;
  const t = 10;
  const M = s.measurements;
  const text = (key: keyof typeof M) => M[key].value.trim() || MEASUREMENT_LETTER[key];

  const isCurved = s.type === "cylinder" || s.type === "cone" || s.type === "sphere" || s.type === "hemisphere";
  const isApex = s.type === "cone" || s.type === "pyramid" || s.type === "squarePyramid" || s.type === "triangularPyramid";

  if (M.height.enabled) {
    items.push(
      <g key="mh">
        <line x1={bb.x - 12} y1={bb.y} x2={bb.x - 12} y2={bb.y + bb.h} stroke={c} strokeWidth={1} />
        <text x={bb.x - 16} y={bb.y + bb.h / 2} fontSize={t} fill={c} textAnchor="end" dominantBaseline="central">
          {text("height")}
        </text>
      </g>,
    );
  }
  if (M.width.enabled) {
    items.push(
      <g key="mw">
        <line x1={bb.x} y1={bb.y + bb.h + 14} x2={bb.x + bb.w} y2={bb.y + bb.h + 14} stroke={c} strokeWidth={1} />
        <text x={bb.x + bb.w / 2} y={bb.y + bb.h + 24} fontSize={t} fill={c} textAnchor="middle">
          {text("width")}
        </text>
      </g>,
    );
  }
  if (M.length.enabled) {
    items.push(
      <g key="ml">
        <line x1={bb.x} y1={bb.y - 12} x2={bb.x + bb.w} y2={bb.y - 12} stroke={c} strokeWidth={1} />
        <text x={bb.x + bb.w / 2} y={bb.y - 16} fontSize={t} fill={c} textAnchor="middle">
          {text("length")}
        </text>
      </g>,
    );
  }
  if (M.radius.enabled && isCurved) {
    const rx = (s.width * s.size) / 2;
    items.push(
      <g key="mr">
        <line x1={s.x} y1={s.y} x2={s.x + rx} y2={s.y} stroke={c} strokeWidth={1} />
        <text x={s.x + rx / 2} y={s.y - 3} fontSize={t} fill={c} textAnchor="middle">
          {text("radius")}
        </text>
      </g>,
    );
  }
  if (M.diameter.enabled && isCurved) {
    const rx = (s.width * s.size) / 2;
    items.push(
      <g key="md">
        <line x1={s.x - rx} y1={s.y} x2={s.x + rx} y2={s.y} stroke={c} strokeWidth={1} />
        <text x={s.x} y={s.y - 3} fontSize={t} fill={c} textAnchor="middle">
          {text("diameter")}
        </text>
      </g>,
    );
  }
  if (M.slantHeight.enabled && isApex) {
    const rx = (s.width * s.size) / 2;
    const h = s.height * s.size;
    const apexY = s.y - h / 2;
    const baseY = s.y + h / 2;
    items.push(
      <g key="ms">
        <line x1={s.x} y1={apexY} x2={s.x + rx} y2={baseY} stroke={c} strokeWidth={1} strokeDasharray="3 3" />
        <text x={s.x + rx / 2 + 4} y={(apexY + baseY) / 2} fontSize={t} fill={c} textAnchor="start" dominantBaseline="central">
          {text("slantHeight")}
        </text>
      </g>,
    );
  }
  return <g pointerEvents="none">{items}</g>;
}

function boundingBox(s: UCESolid) {
  // Rotate 8 extremes to find bbox for polygonal; use w/h/d for curved.
  const w = s.width * s.size / 2;
  const h = s.height * s.size / 2;
  const d = s.depth * s.size / 2;
  const corners = [
    { x: -w, y: -h, z: -d }, { x:  w, y: -h, z: -d },
    { x:  w, y:  h, z: -d }, { x: -w, y:  h, z: -d },
    { x: -w, y: -h, z:  d }, { x:  w, y: -h, z:  d },
    { x:  w, y:  h, z:  d }, { x: -w, y:  h, z:  d },
  ];
  const rotated = corners.map((c) => rotate(c, s.rotX, s.rotY, s.rotZ));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const r of rotated) {
    if (r.x < minX) minX = r.x;
    if (r.x > maxX) maxX = r.x;
    if (-r.y < minY) minY = -r.y;
    if (-r.y > maxY) maxY = -r.y;
  }
  return { x: s.x + minX, y: s.y + minY, w: maxX - minX, h: maxY - minY };
}

function Handle({ x, y, onDown, title, color }: { x: number; y: number; onDown: (e: React.PointerEvent) => void; title?: string; color?: string }) {
  return (
    <circle cx={x} cy={y} r={6}
      fill={color ?? "hsl(var(--background))"} stroke="hsl(var(--primary))" strokeWidth={2}
      onPointerDown={onDown}
      style={{ cursor: "grab" }}>
      {title ? <title>{title}</title> : null}
    </circle>
  );
}
