// CircleEngineCanvas — SVG renderer + interactive handles for every
// circle-family asset. Mirrors LineEngineCanvas: window-level drag so
// the pointer isn't caged by the SVG viewBox, overflow:visible so shapes
// can grow beyond the initial frame.

import { useEffect, useRef, useState } from "react";
import type { UCECircle, UCEModel } from "./types";
import { angleFromCentre, circlePath, distance, pointOnRim } from "./geometry";

interface Props {
  model: UCEModel;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  onChange: (m: UCEModel) => void;
  editable: boolean;
}

type Drag =
  | { kind: "move"; id: string; ox: number; oy: number }
  | { kind: "radius"; id: string }
  | { kind: "start"; id: string }
  | { kind: "end"; id: string };

export function CircleEngineCanvas({ model, selection, onSelectionChange, onChange, editable }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const modelRef = useRef(model);
  const onChangeRef = useRef(onChange);
  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const beginDrag = (e: React.PointerEvent, drag: Drag) => {
    if (!editable) return;
    e.stopPropagation();
    const c = model.circles.find((c) => c.id === drag.id);
    if (c?.locked) return;
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
      const circles = m.circles.map((c) => {
        if (c.id !== d.id) return c;
        if (d.kind === "move") {
          const dx = p.x - d.ox, dy = p.y - d.oy;
          dragRef.current = { ...d, ox: p.x, oy: p.y };
          return { ...c, cx: c.cx + dx, cy: c.cy + dy };
        }
        if (d.kind === "radius") {
          const r = Math.max(6, distance(c, p.x, p.y));
          return { ...c, r };
        }
        if (d.kind === "start") {
          const a = angleFromCentre(c, p.x, p.y);
          // keep end fixed
          const end = c.startDeg + c.sweepDeg;
          let sweep = end - a;
          sweep = ((sweep % 360) + 360) % 360;
          return { ...c, startDeg: a, sweepDeg: sweep || 1 };
        }
        // end
        const a = angleFromCentre(c, p.x, p.y);
        let sweep = a - c.startDeg;
        sweep = ((sweep % 360) + 360) % 360;
        return { ...c, sweepDeg: sweep || 1 };
      });
      onChangeRef.current({ ...m, circles });
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

  const dashFor = (c: UCECircle) =>
    c.style === "dashed" ? "6 4" : c.style === "dotted" ? "1 4" : undefined;

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
      {model.circles.map((c) => {
        const selected = selection.includes(c.id);
        const dash = dashFor(c);
        const hasArc = c.type !== "circle";
        const startPt = hasArc ? pointOnRim(c, c.startDeg) : null;
        const endPt = hasArc ? pointOnRim(c, c.startDeg + c.sweepDeg) : null;
        const handleAngle = c.type === "circle" ? 0 : c.startDeg + c.sweepDeg / 2;
        const radiusHandle = pointOnRim(c, handleAngle);

        return (
          <g key={c.id} opacity={c.opacity}>
            {/* fill + outline */}
            <path
              d={circlePath(c)}
              stroke={c.color}
              strokeWidth={c.thickness}
              strokeDasharray={dash}
              fill={c.fill === "none" ? "none" : c.fill}
              fillOpacity={c.fill === "none" ? 0 : c.fillOpacity}
              onPointerDown={(e) => {
                const p = clientToSvg(e.clientX, e.clientY);
                beginDrag(e, { kind: "move", id: c.id, ox: p.x, oy: p.y });
              }}
              style={{ cursor: editable ? "grab" : "default" }}
            />

            {/* diameter */}
            {c.showDiameter && (() => {
              const a = pointOnRim(c, c.diameterAngleDeg);
              const b = pointOnRim(c, c.diameterAngleDeg + 180);
              return (
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={c.color} strokeWidth={c.thickness} strokeDasharray={dash} pointerEvents="none" />
              );
            })()}

            {/* radii */}
            {c.radii.map((deg, i) => {
              const p = pointOnRim(c, deg);
              return (
                <line key={i} x1={c.cx} y1={c.cy} x2={p.x} y2={p.y}
                  stroke={c.color} strokeWidth={c.thickness} strokeDasharray={dash} pointerEvents="none" />
              );
            })}

            {/* centre */}
            {c.showCentre && (
              <circle cx={c.cx} cy={c.cy} r={2.5} fill={c.color} pointerEvents="none" />
            )}
            {c.showCentre && c.centreLabel && (
              <text x={c.cx - 8} y={c.cy - 6} fontSize={12} fill={c.color} pointerEvents="none">
                {c.centreLabel}
              </text>
            )}

            {/* rim labels */}
            {c.rimLabels.map((lab, i) => {
              const p = pointOnRim({ ...c, r: c.r + 10 }, lab.angleDeg);
              return (
                <text key={i} x={p.x} y={p.y} fontSize={12} fill={c.color}
                  textAnchor="middle" dominantBaseline="central" pointerEvents="none">
                  {lab.text}
                </text>
              );
            })}

            {/* selection halo + handles */}
            {selected && editable && (
              <>
                <path d={circlePath(c)} stroke="hsl(var(--primary))" strokeWidth={c.thickness + 4}
                  fill="none" opacity={0.15} pointerEvents="none" />
                <Handle x={radiusHandle.x} y={radiusHandle.y}
                  onDown={(e) => beginDrag(e, { kind: "radius", id: c.id })}
                  title="Drag to resize" />
                {startPt && (
                  <Handle x={startPt.x} y={startPt.y}
                    onDown={(e) => beginDrag(e, { kind: "start", id: c.id })}
                    title="Arc start" />
                )}
                {endPt && (
                  <Handle x={endPt.x} y={endPt.y}
                    onDown={(e) => beginDrag(e, { kind: "end", id: c.id })}
                    title="Arc end" />
                )}
                {/* centre handle */}
                <Handle x={c.cx} y={c.cy}
                  onDown={(e) => {
                    const p = clientToSvg(e.clientX, e.clientY);
                    beginDrag(e, { kind: "move", id: c.id, ox: p.x, oy: p.y });
                  }}
                  title="Move centre" />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Handle({ x, y, onDown, title }: { x: number; y: number; onDown: (e: React.PointerEvent) => void; title?: string }) {
  return (
    <circle cx={x} cy={y} r={6}
      fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={2}
      onPointerDown={onDown}
      style={{ cursor: "grab" }}>
      {title ? <title>{title}</title> : null}
    </circle>
  );
}
