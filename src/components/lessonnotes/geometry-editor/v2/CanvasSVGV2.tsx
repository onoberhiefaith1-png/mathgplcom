// CanvasSVGV2 — renders v2 scene objects (Phase 1: points only) and
// handles pointer interaction for the active tool.

import { useEffect, useRef, useState } from "react";
import type { V2Scene, V2Id, V2Point } from "@/lib/geometry/v2/scene";
import { addPoint, findPoint, movePoint } from "@/lib/geometry/v2/scene";
import type { V2Tool } from "./LeftRailV2";

interface Props {
  scene: V2Scene;
  onChange: (next: V2Scene) => void;
  tool: V2Tool;
  selectedId: V2Id | null;
  onSelect: (id: V2Id | null) => void;
  showHidden?: boolean;
}

const PAD = 16;
const DOT_R = 4;
const HIT_R = 12;
const LABEL_FONT = "'Times New Roman', Georgia, serif";

export function CanvasSVGV2({ scene, onChange, tool, selectedId, onSelect, showHidden }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<{ id: V2Id; kind: "point" | "label" } | null>(null);

  const W = scene.bounds.width + PAD * 2;
  const H = scene.bounds.height + PAD * 2;

  const toScene = (evt: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x - PAD, y: local.y - PAD };
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // Global pointer move / up while dragging.
  useEffect(() => {
    if (!dragging) return;
    const svg = svgRef.current;
    if (!svg) return;
    const onMove = (e: PointerEvent) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const local = pt.matrixTransform(ctm.inverse());
      const x = clamp(local.x - PAD, 0, scene.bounds.width);
      const y = clamp(local.y - PAD, 0, scene.bounds.height);
      if (dragging.kind === "point") {
        onChange(movePoint(scene, dragging.id, x, y));
      } else {
        // label drag → update labelOffset relative to point position.
        const p = findPoint(scene, dragging.id);
        if (!p) return;
        const dx = clamp(x - p.x, -60, 60);
        const dy = clamp(y - p.y, -60, 60);
        onChange({
          ...scene,
          objects: scene.objects.map((o) =>
            o.id === dragging.id && o.type === "point"
              ? { ...o, labelOffset: { dx, dy } }
              : o,
          ),
        });
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, scene, onChange]);

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Clicks that reach the SVG background — not on an object handle.
    if (e.target !== svgRef.current) return;
    e.stopPropagation();
    if (tool === "point") {
      const { x, y } = toScene(e);
      if (x < 0 || y < 0 || x > scene.bounds.width || y > scene.bounds.height) return;
      const { scene: next, id } = addPoint(scene, x, y);
      onChange(next);
      onSelect(id);
      return;
    }
    // Select tool or any other → clear selection.
    onSelect(null);
  };

  return (
    <svg
      ref={svgRef}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      onPointerDown={handleSvgPointerDown}
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 6,
        cursor: tool === "point" ? "crosshair" : "default",
        touchAction: "none",
      }}
    >
      {/* Origin group so scene coords start at (0,0). */}
      <g transform={`translate(${PAD} ${PAD})`}>
        {/* Optional grid guide */}
        <rect
          x={0}
          y={0}
          width={scene.bounds.width}
          height={scene.bounds.height}
          fill="transparent"
          stroke="rgba(0,0,0,0.06)"
        />

        {scene.objects.map((o) => {
          if (o.type !== "point") return null;
          const p = o as V2Point;
          if (p.hidden && !showHidden) return null;
          const isSelected = selectedId === p.id;
          const opacity = p.hidden ? 0.35 : 1;
          const cursor = tool === "select" ? "grab" : "pointer";
          return (
            <g key={p.id} opacity={opacity}>
              {/* Invisible hit-target */}
              <circle
                cx={p.x}
                cy={p.y}
                r={HIT_R}
                fill="transparent"
                style={{ cursor }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(p.id);
                  if (tool === "select" || tool === "point") {
                    setDragging({ id: p.id, kind: "point" });
                  }
                }}
              />
              {/* Visible dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={DOT_R}
                fill={p.color}
                stroke={isSelected ? "#2563eb" : "transparent"}
                strokeWidth={isSelected ? 2 : 0}
                pointerEvents="none"
              />
              {/* Label */}
              {p.labelText ? (
                <text
                  x={p.x + p.labelOffset.dx}
                  y={p.y + p.labelOffset.dy}
                  fill={p.labelColor ?? p.color}
                  fontFamily={LABEL_FONT}
                  fontStyle="italic"
                  fontSize={14}
                  style={{ cursor: "move", userSelect: "none" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelect(p.id);
                    setDragging({ id: p.id, kind: "label" });
                  }}
                >
                  {p.labelText}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
