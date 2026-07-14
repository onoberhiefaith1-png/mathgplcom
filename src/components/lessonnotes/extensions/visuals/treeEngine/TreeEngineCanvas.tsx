import { useMemo } from "react";
import type { TreeModel, TreeNode } from "./types";
import { layoutTree } from "./layout";

interface Props {
  model: TreeModel;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  editable: boolean;
}

export function TreeEngineCanvas({ model, selectedId, onSelect, onAddChild, onDelete, editable }: Props) {
  const { nodes, width, height, offsetX, offsetY } = useMemo(
    () => layoutTree(model.root, model.direction),
    [model],
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const isVisibleChain = (nodeId: string): boolean => {
    let cur: TreeNode | undefined = byId.get(nodeId)?.node;
    let parentId = byId.get(nodeId)?.parentId;
    while (parentId) {
      const p = byId.get(parentId);
      if (!p) break;
      if (!p.node.revealed) return false;
      parentId = p.parentId;
    }
    return true;
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto select-none"
      style={{ minWidth: 240, maxWidth: "100%" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id="tree-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
        </marker>
      </defs>

      {/* Edges */}
      {nodes.map(({ id, node, x, y, parentId }) => {
        if (!parentId) return null;
        const p = byId.get(parentId);
        if (!p) return null;
        if (!isVisibleChain(parentId) || !p.node.revealed) return null;
        const x1 = p.x + offsetX, y1 = p.y + offsetY;
        const x2 = x + offsetX, y2 = y + offsetY;
        const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
        const b = node.branch;
        return (
          <g key={`e-${id}`} style={{ color: model.defaults.color }}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="currentColor"
              strokeWidth={b.thickness}
              strokeDasharray={b.dash === "dashed" ? "5 3" : undefined}
              markerEnd={b.arrow ? "url(#tree-arr)" : undefined}
            />
            {(b.label || b.prob) && (
              <g>
                <rect x={midX - 22} y={midY - 10} width={44} height={16} rx={3}
                  fill="hsl(var(--background))" opacity={0.9}/>
                <text x={midX} y={midY + 2} textAnchor="middle" fontSize={11} fill="currentColor">
                  {b.label}{b.label && b.prob ? " " : ""}{b.prob}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(({ id, node, x, y }) => {
        if (!isVisibleChain(id)) return null;
        const cx = x + offsetX, cy = y + offsetY;
        const r = node.size;
        const selected = selectedId === id;
        return (
          <g
            key={id}
            style={{ cursor: editable ? "pointer" : "default" }}
            onClick={(e) => { e.stopPropagation(); onSelect(id); }}
          >
            <circle
              cx={cx} cy={cy} r={r}
              fill="hsl(var(--background))"
              stroke={node.color}
              strokeWidth={selected ? 3 : 1.8}
            />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill={node.color}>
              {node.label}
            </text>
            {node.expr && (
              <text x={cx} y={cy + r + 12} textAnchor="middle" fontSize={10} fill={node.color}>
                {node.expr}
              </text>
            )}
            {node.prob && (
              <text x={cx + r + 4} y={cy - r + 4} fontSize={10} fill={node.color}>
                {node.prob}
              </text>
            )}
            {editable && selected && (
              <>
                <g
                  onClick={(e) => { e.stopPropagation(); onAddChild(id); }}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={cx + r + 12} cy={cy + r + 4} r={9} fill="#3b82f6" />
                  <text x={cx + r + 12} y={cy + r + 8} textAnchor="middle" fontSize={13} fill="white" fontWeight={700}>+</text>
                </g>
                <g
                  onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={cx - r - 12} cy={cy - r - 4} r={9} fill="#ef4444" />
                  <text x={cx - r - 12} y={cy - r} textAnchor="middle" fontSize={13} fill="white" fontWeight={700}>×</text>
                </g>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
