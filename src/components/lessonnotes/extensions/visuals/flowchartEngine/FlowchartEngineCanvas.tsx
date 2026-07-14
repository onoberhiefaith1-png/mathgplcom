import { useRef, useState } from "react";
import type { FlowModel, FlowNode } from "./types";
import { edgePath, edgeLabelPoint } from "./routing";

interface Props {
  model: FlowModel;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (m: FlowModel) => void;
  editable: boolean;
  connectFrom: string | null;
  onConnect: (fromId: string, toId: string) => void;
}

export function FlowchartEngineCanvas({ model, selectedId, onSelect, onChange, editable, connectFrom, onConnect }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const byId = new Map(model.nodes.map((n) => [n.id, n]));

  const svgPt = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: ((e.clientX - rect.left) / rect.width) * vb.width,
      y: ((e.clientY - rect.top) / rect.height) * vb.height,
    };
  };

  const beginDrag = (n: FlowNode, e: React.PointerEvent) => {
    if (!editable) return;
    const p = svgPt(e);
    setDrag({ id: n.id, dx: p.x - n.x, dy: p.y - n.y });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = svgPt(e);
    const next = { ...model, layout: "free" as const, nodes: model.nodes.map((n) =>
      n.id === drag.id ? { ...n, x: p.x - drag.dx, y: p.y - drag.dy } : n) };
    onChange(next);
  };
  const endDrag = () => setDrag(null);

  const shapeEl = (n: FlowNode) => {
    const selected = selectedId === n.id;
    const isConnectSource = connectFrom === n.id;
    const commonText = (
      <foreignObject x={n.x} y={n.y} width={n.w} height={n.h} pointerEvents="none">
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center",
          justifyContent: n.align === "left" ? "flex-start" : n.align === "right" ? "flex-end" : "center",
          padding: "0 6px", fontSize: 12, color: n.border, textAlign: n.align,
          lineHeight: 1.2,
        }}>
          {n.text}
        </div>
      </foreignObject>
    );
    const stroke = isConnectSource ? "#3b82f6" : n.border;
    const strokeWidth = selected || isConnectSource ? 3 : 1.6;
    let shape: JSX.Element;
    switch (n.kind) {
      case "decision":
        shape = <polygon points={`${n.x + n.w/2},${n.y} ${n.x + n.w},${n.y + n.h/2} ${n.x + n.w/2},${n.y + n.h} ${n.x},${n.y + n.h/2}`}
          fill={n.fill} stroke={stroke} strokeWidth={strokeWidth}/>;
        break;
      case "io":
        shape = <polygon
          points={`${n.x + 15},${n.y} ${n.x + n.w},${n.y} ${n.x + n.w - 15},${n.y + n.h} ${n.x},${n.y + n.h}`}
          fill={n.fill} stroke={stroke} strokeWidth={strokeWidth}/>;
        break;
      case "connector":
        shape = <circle cx={n.x + n.w/2} cy={n.y + n.h/2} r={Math.min(n.w, n.h)/2}
          fill={n.fill} stroke={stroke} strokeWidth={strokeWidth}/>;
        break;
      case "start":
      case "end":
        shape = <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.h/2} ry={n.h/2}
          fill={n.fill} stroke={stroke} strokeWidth={strokeWidth}/>;
        break;
      case "comment":
        shape = <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.radius} ry={n.radius}
          fill={n.fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray="4 3"/>;
        break;
      default:
        shape = <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.radius} ry={n.radius}
          fill={n.fill} stroke={stroke} strokeWidth={strokeWidth}/>;
    }

    return (
      <g key={n.id}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (connectFrom && connectFrom !== n.id) { onConnect(connectFrom, n.id); return; }
          onSelect(n.id);
          beginDrag(n, e);
        }}
        style={{ cursor: editable ? "move" : "default" }}>
        {shape}
        {commonText}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${model.canvas.w} ${model.canvas.h}`}
      className="w-full h-auto"
      style={{ maxWidth: "100%", background: "hsl(var(--muted) / 0.15)", borderRadius: 6 }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerDown={() => onSelect(null)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id="flow-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#334155"/>
        </marker>
      </defs>

      {model.edges.map((e) => {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b) return null;
        const d = edgePath(a, b, e);
        const lp = edgeLabelPoint(a, b);
        return (
          <g key={e.id}>
            <path d={d} fill="none" stroke="#334155" strokeWidth={1.6}
              strokeDasharray={e.dash === "dashed" ? "5 3" : undefined}
              markerEnd={e.arrow ? "url(#flow-arr)" : undefined}/>
            {e.label && (
              <g>
                <rect x={lp.x - 22} y={lp.y - 9} width={44} height={16} rx={3}
                  fill="hsl(var(--background))" opacity={0.95}/>
                <text x={lp.x} y={lp.y + 3} textAnchor="middle" fontSize={11} fill="#334155">{e.label}</text>
              </g>
            )}
          </g>
        );
      })}

      {model.nodes.map(shapeEl)}
    </svg>
  );
}
