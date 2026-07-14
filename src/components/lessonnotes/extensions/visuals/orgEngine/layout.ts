// Directional tree layout for the org engine. Supports TB / BT / LR / RL
// (tree layout with subtree extent), radial (concentric levels), and
// free (uses stored fx/fy).

import type { OrgDirection, OrgNode } from "./types";

export interface OrgLaid {
  id: string;
  node: OrgNode;
  x: number;
  y: number;
  w: number;
  h: number;
  parentId: string | null;
}

const NODE_W = 110, NODE_H = 44;
const H_GAP = 30, V_GAP = 60;

function activeChildren(n: OrgNode): OrgNode[] {
  return n.collapsed ? [] : n.children;
}

export function layoutOrg(root: OrgNode, direction: OrgDirection) {
  if (direction === "free") return layoutFree(root);
  if (direction === "radial") return layoutRadial(root);

  // TB / BT / LR / RL
  const vertical = direction === "TB" || direction === "BT";
  const reverse = direction === "BT" || direction === "RL";

  const extent = new Map<string, number>();
  const measure = (n: OrgNode): number => {
    const kids = activeChildren(n);
    if (kids.length === 0) {
      const e = vertical ? NODE_W : NODE_H;
      extent.set(n.id, e);
      return e;
    }
    let total = 0;
    kids.forEach((c, i) => { total += measure(c); if (i < kids.length - 1) total += vertical ? H_GAP : H_GAP; });
    total = Math.max(total, vertical ? NODE_W : NODE_H);
    extent.set(n.id, total);
    return total;
  };
  measure(root);

  const list: OrgLaid[] = [];
  const place = (n: OrgNode, cross: number, depth: number, parentId: string | null) => {
    const ext = extent.get(n.id)!;
    const cx = cross + ext / 2;
    let x: number, y: number;
    if (vertical) {
      x = cx - NODE_W / 2;
      y = depth * (NODE_H + V_GAP);
    } else {
      x = depth * (NODE_W + V_GAP);
      y = cx - NODE_H / 2;
    }
    list.push({ id: n.id, node: n, x, y, w: NODE_W, h: NODE_H, parentId });
    let cursor = cross;
    activeChildren(n).forEach((c) => {
      const cExt = extent.get(c.id)!;
      place(c, cursor, depth + 1, n.id);
      cursor += cExt + H_GAP;
    });
  };
  place(root, 0, 0, null);

  if (reverse) {
    const maxDepth = Math.max(...list.map((l) => vertical ? l.y : l.x));
    list.forEach((l) => {
      if (vertical) l.y = maxDepth - l.y;
      else l.x = maxDepth - l.x;
    });
  }

  return normalise(list);
}

function layoutRadial(root: OrgNode) {
  const list: OrgLaid[] = [];
  const cx = 260, cy = 220;
  list.push({ id: root.id, node: root, x: cx - NODE_W/2, y: cy - NODE_H/2, w: NODE_W, h: NODE_H, parentId: null });
  const walk = (parent: OrgNode, px: number, py: number, level: number) => {
    const kids = activeChildren(parent);
    if (!kids.length) return;
    const r = 110 * level;
    kids.forEach((c, i) => {
      const a = (2 * Math.PI * i) / kids.length + level * 0.3;
      const x = cx + Math.cos(a) * r - NODE_W / 2;
      const y = cy + Math.sin(a) * r - NODE_H / 2;
      list.push({ id: c.id, node: c, x, y, w: NODE_W, h: NODE_H, parentId: parent.id });
      walk(c, x, y, level + 1);
    });
  };
  walk(root, cx, cy, 1);
  return normalise(list);
}

function layoutFree(root: OrgNode) {
  const list: OrgLaid[] = [];
  const walk = (n: OrgNode, parentId: string | null, fx = 100, fy = 100) => {
    const x = n.fx ?? fx, y = n.fy ?? fy;
    list.push({ id: n.id, node: n, x, y, w: NODE_W, h: NODE_H, parentId });
    activeChildren(n).forEach((c, i) => walk(c, n.id, x + 140, y + i * 60));
  };
  walk(root, null);
  return normalise(list);
}

function normalise(list: OrgLaid[]) {
  const pad = 30;
  const minX = Math.min(...list.map((l) => l.x));
  const minY = Math.min(...list.map((l) => l.y));
  const maxX = Math.max(...list.map((l) => l.x + l.w));
  const maxY = Math.max(...list.map((l) => l.y + l.h));
  const offX = pad - minX, offY = pad - minY;
  list.forEach((l) => { l.x += offX; l.y += offY; });
  return {
    nodes: list,
    width: (maxX - minX) + pad * 2,
    height: (maxY - minY) + pad * 2,
  };
}

export function cloneOrg(n: OrgNode): OrgNode {
  return { ...n, edge: { ...n.edge }, children: n.children.map(cloneOrg) };
}
export function findOrg(n: OrgNode, id: string): OrgNode | null {
  if (n.id === id) return n;
  for (const c of n.children) { const f = findOrg(c, id); if (f) return f; }
  return null;
}
export function findOrgParent(n: OrgNode, id: string): OrgNode | null {
  for (const c of n.children) { if (c.id === id) return n; const f = findOrgParent(c, id); if (f) return f; }
  return null;
}
