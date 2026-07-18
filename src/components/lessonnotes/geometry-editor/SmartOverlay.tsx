// Transparent SVG overlay above the diagram. Picks smart parts under the
// pointer, glows the hovered one, and toggles selection on click. Coords
// match GeometryDiagram's PAD=24 layout.

import { useRef } from "react";
import { useSmartGeometry } from "./SmartGeometryContext";
import { pickPart } from "@/lib/geometry/smart/hitTest";
import type { SmartPartBase } from "@/lib/geometry/smart/parts";

const PAD = 24;
const HOVER = "#2563eb";
const SELECTED = "#f59e0b";

interface Props { width: number; height: number; }

export function SmartOverlay({ width, height }: Props) {
  const { graph, hoveredId, setHoveredId, selectedIds, toggleSelected, clearSelection } = useSmartGeometry();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const toLogical = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    // preserveAspectRatio defaults to "xMidYMid meet" — un-project with
    // uniform scale + letterbox centring so hover/selection lands on the
    // exact part under the cursor regardless of container aspect ratio.
    const scale = Math.min(r.width / width, r.height / height) || 1;
    const offsetX = (r.width - width * scale) / 2;
    const offsetY = (r.height - height * scale) / 2;
    return {
      x: (e.clientX - r.left - offsetX) / scale - PAD,
      y: (e.clientY - r.top - offsetY) / scale - PAD,
    };
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="absolute inset-0"
      style={{ pointerEvents: "auto" }}
      onPointerMove={(e) => {
        const p = toLogical(e);
        const part = pickPart(graph, p.x, p.y);
        setHoveredId(part?.id ?? null);
      }}
      onPointerLeave={() => setHoveredId(null)}
      onClick={(e) => {
        // Additive selection: every click on a part toggles that part in
        // place. Previous selections are preserved so the teacher can
        // build A, A+B, A+B+C contexts. Background clicks no longer
        // clear — use the explicit "Clear selection" button.
        const p = toLogical(e);
        const part = pickPart(graph, p.x, p.y);
        if (part) {
          toggleSelected(part.id);
          e.stopPropagation();
        }
      }}
    >
      {graph.parts.map((p) => {
        const isHover = p.id === hoveredId;
        const isSel = selectedIds.includes(p.id);
        if (!isHover && !isSel) return null;
        return renderGlow(p, isSel ? SELECTED : HOVER, isSel ? 2.2 : 1.6);
      })}
    </svg>
  );
}

function renderGlow(p: SmartPartBase, color: string, sw: number) {
  const h = p.hit;
  switch (h.kind) {
    case "point":
      return <circle key={p.id} cx={h.x + PAD} cy={h.y + PAD} r={Math.max(h.r, 7)} fill="none" stroke={color} strokeWidth={sw} opacity={0.85} />;
    case "segment":
      return <line key={p.id} x1={h.x1 + PAD} y1={h.y1 + PAD} x2={h.x2 + PAD} y2={h.y2 + PAD} stroke={color} strokeWidth={sw + 1.5} opacity={0.6} strokeLinecap="round" />;
    case "circle":
      return <circle key={p.id} cx={h.cx + PAD} cy={h.cy + PAD} r={h.r} fill="none" stroke={color} strokeWidth={sw + 1.2} opacity={0.6} />;
    case "arc": {
      const a1 = (h.from * Math.PI) / 180;
      const a2 = (h.to * Math.PI) / 180;
      const x1 = h.cx + PAD + Math.cos(a1) * h.r;
      const y1 = h.cy + PAD - Math.sin(a1) * h.r;
      const x2 = h.cx + PAD + Math.cos(a2) * h.r;
      const y2 = h.cy + PAD - Math.sin(a2) * h.r;
      const large = Math.abs(h.to - h.from) > 180 ? 1 : 0;
      const sweep = h.to > h.from ? 0 : 1;
      return <path key={p.id} d={`M ${x1} ${y1} A ${h.r} ${h.r} 0 ${large} ${sweep} ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={sw + 1.2} opacity={0.6} />;
    }
  }
}
