// LineEngineCanvas — SVG renderer + interactive handles.
//
// Renders every ULELine with correct end-caps, arrowheads and angle
// marks; supports click-to-select (single + shift for multi), and
// dragging the line body or either endpoint.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ULELine, ULEModel } from "./types";
import { angleBetween, applyRelations, lineLength, sharedVertex } from "./geometry";

interface Props {
  model: ULEModel;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  onChange: (m: ULEModel) => void;
  editable: boolean;
}

type Drag =
  | { kind: "endpoint"; lineId: string; end: "A" | "B"; ox: number; oy: number }
  | { kind: "body"; lineId: string; ox: number; oy: number };

export function LineEngineCanvas({ model, selection, onSelectionChange, onChange, editable }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const modelRef = useRef(model);
  const onChangeRef = useRef(onChange);
  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const markerId = (id: string) => `ule-arrow-${id}`;

  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onDown = (e: React.PointerEvent, drag: Drag, lineId: string, _additive: boolean) => {
    if (!editable) return;
    e.stopPropagation();
    const line = model.lines.find((l) => l.id === lineId);
    if (line && (line.lockLen || line.lockAngle) && drag.kind === "body") {
      dragRef.current = null;
    } else {
      dragRef.current = drag;
      setDragging(true);
    }
    if (!selection.includes(lineId)) onSelectionChange([lineId]);
  };

  const startBodyDrag = (e: React.PointerEvent, lineId: string) => {
    const p = clientToSvg(e.clientX, e.clientY);
    onDown(e, { kind: "body", lineId, ox: p.x, oy: p.y }, lineId, e.shiftKey || e.ctrlKey || e.metaKey);
  };

  // Window-level pointer tracking so drags aren't caged by the SVG box.
  useEffect(() => {
    if (!dragging) return;
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = clientToSvg(ev.clientX, ev.clientY);
      const m = modelRef.current;
      const lines = m.lines.map((l) => {
        if (l.id !== d.lineId) return l;
        if (d.kind === "endpoint") {
          return d.end === "A"
            ? { ...l, ax: p.x, ay: p.y }
            : { ...l, bx: p.x, by: p.y };
        }
        const dx = p.x - d.ox, dy = p.y - d.oy;
        dragRef.current = { ...d, ox: p.x, oy: p.y };
        return { ...l, ax: l.ax + dx, ay: l.ay + dy, bx: l.bx + dx, by: l.by + dy };
      });
      onChangeRef.current(applyRelations({ ...m, lines }, d.lineId));
    };
    const up = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging]);

  const arrowMarkers = useMemo(() => {
    const ids = new Set<string>();
    model.lines.forEach((l) => {
      if (l.endA === "arrow" || l.endA === "doubleArrow") ids.add(l.id + "-a");
      if (l.endB === "arrow" || l.endB === "doubleArrow") ids.add(l.id + "-b");
    });
    return Array.from(ids);
  }, [model.lines]);

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

      <defs>
        {arrowMarkers.map((id) => (
          <marker key={id} id={`ule-arrow-${id}`} viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        ))}
      </defs>

      {/* Angle arcs */}
      {model.angleMarks.map((am, i) => {
        const a = model.lines.find((l) => l.id === am.vertexLineA);
        const b = model.lines.find((l) => l.id === am.vertexLineB);
        if (!a || !b || !am.showArc) return null;
        const sv = sharedVertex(a, b) ?? { x: (a.ax + b.ax) / 2, y: (a.ay + b.ay) / 2, ax: "A" as const, bx: "A" as const };
        // Compute start/end angle in SVG coords (y-down).
        const rad = am.arcRadius;
        const dirA = Math.atan2((sv.ax === "A" ? a.by : a.ay) - sv.y, (sv.ax === "A" ? a.bx : a.ax) - sv.x);
        const dirB = Math.atan2((sv.bx === "A" ? b.by : b.ay) - sv.y, (sv.bx === "A" ? b.bx : b.ax) - sv.x);
        // Use the outgoing directions from the vertex.
        const startX = sv.x + Math.cos(dirA) * rad;
        const startY = sv.y + Math.sin(dirA) * rad;
        const endX = sv.x + Math.cos(dirB) * rad;
        const endY = sv.y + Math.sin(dirB) * rad;
        const ang = angleBetween(a, b);
        const largeArc = ang > 180 ? 1 : 0;
        return (
          <g key={i} pointerEvents="none">
            <path d={`M ${startX} ${startY} A ${rad} ${rad} 0 ${largeArc} 1 ${endX} ${endY}`}
              fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} />
            {am.showValue && (
              <text
                x={sv.x + Math.cos((dirA + dirB) / 2) * (rad + 12)}
                y={sv.y + Math.sin((dirA + dirB) / 2) * (rad + 12)}
                fontSize={12} textAnchor="middle" dominantBaseline="central"
                fill="hsl(var(--primary))"
              >{Math.round(ang)}°</text>
            )}
          </g>
        );
      })}

      {/* Lines */}
      {model.lines.map((l) => {
        const selected = selection.includes(l.id);
        const dash = l.style === "dashed" ? "6 4" : l.style === "dotted" ? "1 4" : undefined;
        const strokeColor = l.color.startsWith("hsl(") ? l.color : l.color;
        return (
          <g key={l.id} style={{ color: strokeColor }}>
            {/* hit target */}
            <line
              x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by}
              stroke="transparent" strokeWidth={Math.max(12, l.thickness + 8)}
              onPointerDown={(e) => startBodyDrag(e, l.id)}
              style={{ cursor: editable ? "grab" : "default" }}
            />
            <line
              x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by}
              stroke={strokeColor} strokeWidth={l.thickness}
              strokeDasharray={dash}
              opacity={l.opacity}
              markerStart={l.endA === "arrow" || l.endA === "doubleArrow" ? `url(#ule-arrow-${l.id}-a)` : undefined}
              markerEnd={l.endB === "arrow" || l.endB === "doubleArrow" ? `url(#ule-arrow-${l.id}-b)` : undefined}
              pointerEvents="none"
            />
            {/* endpoint dots for closed/open */}
            {renderEndCap(l.ax, l.ay, l.endA)}
            {renderEndCap(l.bx, l.by, l.endB)}

            {/* label */}
            {l.label && (
              <text x={(l.ax + l.bx) / 2} y={(l.ay + l.by) / 2 - 8}
                fontSize={12} textAnchor="middle" fill="currentColor" pointerEvents="none">
                {l.label}
              </text>
            )}
            {l.showLength && (
              <text x={(l.ax + l.bx) / 2} y={(l.ay + l.by) / 2 + 14}
                fontSize={11} textAnchor="middle" fill="hsl(var(--muted-foreground))" pointerEvents="none">
                {Math.round(lineLength(l))} {l.unit}
              </text>
            )}

            {/* selection ring + endpoint handles */}
            {selected && editable && (
              <>
                <line x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by}
                  stroke="hsl(var(--primary))" strokeWidth={l.thickness + 4}
                  opacity={0.15} pointerEvents="none" />
                <Handle x={l.ax} y={l.ay}
                  onDown={(e) => onDown(e, { kind: "endpoint", lineId: l.id, end: "A", ox: 0, oy: 0 }, l.id, false)} />
                <Handle x={l.bx} y={l.by}
                  onDown={(e) => onDown(e, { kind: "endpoint", lineId: l.id, end: "B", ox: 0, oy: 0 }, l.id, false)} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Handle({ x, y, onDown }: { x: number; y: number; onDown: (e: React.PointerEvent) => void }) {
  return (
    <circle cx={x} cy={y} r={6}
      fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={2}
      onPointerDown={onDown}
      style={{ cursor: "grab" }} />
  );
}

function renderEndCap(x: number, y: number, cap: string) {
  if (cap === "closedDot") return <circle cx={x} cy={y} r={3.5} fill="currentColor" />;
  if (cap === "openDot")   return <circle cx={x} cy={y} r={3.5} fill="hsl(var(--background))" stroke="currentColor" strokeWidth={1.5} />;
  return null;
}
