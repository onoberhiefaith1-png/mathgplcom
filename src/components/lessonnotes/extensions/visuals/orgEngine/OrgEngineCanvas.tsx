import { useMemo } from "react";
import type { OrgLaid } from "./layout";
import { layoutOrg } from "./layout";
import type { OrgModel, OrgNode, OrgShape } from "./types";

interface Props {
  model: OrgModel;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  editable: boolean;
}

function shapeEl(n: OrgLaid, selected: boolean) {
  const { node, x, y, w, h } = n;
  const stroke = node.border;
  const sw = selected ? 3 : 1.6;
  switch (node.shape as OrgShape) {
    case "circle":
      return <ellipse cx={x + w/2} cy={y + h/2} rx={w/2} ry={h/2} fill={node.color} stroke={stroke} strokeWidth={sw}/>;
    case "diamond":
      return <polygon points={`${x + w/2},${y} ${x + w},${y + h/2} ${x + w/2},${y + h} ${x},${y + h/2}`}
        fill={node.color} stroke={stroke} strokeWidth={sw}/>;
    case "hexagon":
      return <polygon points={`${x + 15},${y} ${x + w - 15},${y} ${x + w},${y + h/2} ${x + w - 15},${y + h} ${x + 15},${y + h} ${x},${y + h/2}`}
        fill={node.color} stroke={stroke} strokeWidth={sw}/>;
    case "rect":
      return <rect x={x} y={y} width={w} height={h} fill={node.color} stroke={stroke} strokeWidth={sw}/>;
    case "roundedRect":
    default:
      return <rect x={x} y={y} width={w} height={h} rx={10} ry={10} fill={node.color} stroke={stroke} strokeWidth={sw}/>;
  }
}

function edgePath(a: OrgLaid, b: OrgLaid, curved: boolean): string {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2;
  if (!curved) return `M ${ax} ${ay} L ${bx} ${by}`;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  return `M ${ax} ${ay} Q ${mx} ${ay}, ${mx} ${my} T ${bx} ${by}`;
}

export function OrgEngineCanvas({ model, selectedId, onSelect, editable }: Props) {
  const { nodes, width, height } = useMemo(() => layoutOrg(model.root, model.direction), [model]);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none"
      style={{ maxWidth: "100%" }}
      onClick={() => onSelect(null)}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="org-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#334155"/>
        </marker>
      </defs>

      {nodes.map((n) => {
        if (!n.parentId) return null;
        const p = byId.get(n.parentId);
        if (!p) return null;
        const e = n.node.edge;
        const d = edgePath(p, n, e.style === "curved");
        return (
          <g key={`e-${n.id}`}>
            <path d={d} fill="none" stroke="#334155" strokeWidth={1.4}
              strokeDasharray={e.dash === "dashed" ? "5 3" : undefined}
              markerEnd={e.arrow !== "none" ? "url(#org-arr)" : undefined}
              markerStart={e.arrow === "double" ? "url(#org-arr)" : undefined}/>
            {e.label && (
              <text x={(p.x + n.x) / 2 + p.w / 2} y={(p.y + n.y) / 2 + p.h / 2 - 4}
                textAnchor="middle" fontSize={10} fill="#334155">{e.label}</text>
            )}
          </g>
        );
      })}

      {nodes.map((n) => (
        <g key={n.id}
          onClick={(e) => { e.stopPropagation(); onSelect(n.id); }}
          style={{ cursor: editable ? "pointer" : "default" }}>
          {shapeEl(n, selectedId === n.id)}
          <foreignObject x={n.x} y={n.y} width={n.w} height={n.h} pointerEvents="none">
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 6px", fontSize: 12, color: n.node.border, textAlign: "center",
              lineHeight: 1.2,
            }}>{n.node.text}</div>
          </foreignObject>
          {n.node.children.length > 0 && (
            <text x={n.x + n.w - 6} y={n.y + n.h - 4} textAnchor="end" fontSize={9} fill={n.node.border}>
              {n.node.collapsed ? "▸" : "▾"}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export type { OrgNode };
