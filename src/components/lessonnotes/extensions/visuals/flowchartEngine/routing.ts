// Edge routing between two rectangular shapes.
import type { FlowEdge, FlowNode } from "./types";

function boxEdgePoint(from: FlowNode, tx: number, ty: number) {
  const { x, y, w, h } = from;
  const cx = x + w / 2, cy = y + h / 2;
  const dx = tx - cx, dy = ty - cy;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  if (absDx * (h / 2) > absDy * (w / 2)) {
    // exit through vertical side
    const sx = dx > 0 ? x + w : x;
    const sy = cy + (dy * (w / 2)) / (absDx || 1);
    return { x: sx, y: sy };
  }
  const sx = cx + (dx * (h / 2)) / (absDy || 1);
  const sy = dy > 0 ? y + h : y;
  return { x: sx, y: sy };
}

export function edgePath(a: FlowNode, b: FlowNode, edge: FlowEdge): string {
  const ap = boxEdgePoint(a, b.x + b.w / 2, b.y + b.h / 2);
  const bp = boxEdgePoint(b, a.x + a.w / 2, a.y + a.h / 2);

  if (edge.style === "straight") {
    return `M ${ap.x} ${ap.y} L ${bp.x} ${bp.y}`;
  }
  if (edge.style === "curved") {
    const mx = (ap.x + bp.x) / 2;
    return `M ${ap.x} ${ap.y} C ${mx} ${ap.y}, ${mx} ${bp.y}, ${bp.x} ${bp.y}`;
  }
  // orthogonal
  const mx = (ap.x + bp.x) / 2;
  return `M ${ap.x} ${ap.y} L ${mx} ${ap.y} L ${mx} ${bp.y} L ${bp.x} ${bp.y}`;
}

export function edgeLabelPoint(a: FlowNode, b: FlowNode) {
  return { x: (a.x + a.w / 2 + b.x + b.w / 2) / 2, y: (a.y + a.h / 2 + b.y + b.h / 2) / 2 };
}
