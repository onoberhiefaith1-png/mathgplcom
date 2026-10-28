// Compact non-overlapping tree layout. Subtree width is computed
// bottom-up, then nodes are placed at the centre of their subtree.

import type { TreeDirection, TreeNode } from "./types";

export interface LaidNode {
  id: string;
  node: TreeNode;
  x: number;
  y: number;
  parentId: string | null;
}

interface LayoutOpts {
  direction: TreeDirection;
  hGap: number;  // gap between sibling leaves (perpendicular to depth)
  vGap: number;  // gap between depth levels
  leafSize: number;
}

const DEFAULTS: LayoutOpts = { direction: "TB", hGap: 70, vGap: 90, leafSize: 44 };

/** Returns list of nodes + total width/height in svg units. */
export function layoutTree(
  root: TreeNode,
  direction: TreeDirection,
  opts: Partial<LayoutOpts> = {},
) {
  const o: LayoutOpts = { ...DEFAULTS, direction, ...opts };
  const visible = (n: TreeNode) => n.revealed ? n.children.filter((c) => c.revealed || true) : [];
  // We compute all children regardless of `revealed` so layout stays stable;
  // rendering will skip hidden ones. That keeps positions predictable.

  // 1) Compute subtree extent (in the "cross" axis).
  const extentMap = new Map<string, number>();
  const measure = (n: TreeNode): number => {
    if (n.children.length === 0) {
      extentMap.set(n.id, o.leafSize);
      return o.leafSize;
    }
    let total = 0;
    n.children.forEach((c, i) => {
      total += measure(c);
      if (i < n.children.length - 1) total += o.hGap;
    });
    total = Math.max(total, o.leafSize);
    extentMap.set(n.id, total);
    return total;
  };
  measure(root);

  // 2) Place nodes.
  const result: LaidNode[] = [];
  const place = (n: TreeNode, cross: number, depth: number, parentId: string | null) => {
    const ext = extentMap.get(n.id) ?? o.leafSize;
    const cx = cross + ext / 2;
    let x = cx;
    let y = depth * o.vGap;
    if (direction === "LR") { x = depth * o.vGap; y = cx; }
    if (direction === "radial") {
      // radial not yet fully implemented; fall back to TB placement in xy
      // downstream renderer can transform to polar if desired
    }
    result.push({ id: n.id, node: n, x, y, parentId });
    let cursor = cross;
    n.children.forEach((c, i) => {
      const cExt = extentMap.get(c.id) ?? o.leafSize;
      place(c, cursor, depth + 1, n.id);
      cursor += cExt + o.hGap;
    });
  };
  place(root, 0, 0, null);

  const xs = result.map((r) => r.x);
  const ys = result.map((r) => r.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 40;

  return {
    nodes: result,
    width: (maxX - minX) + pad * 2,
    height: (maxY - minY) + pad * 2,
    offsetX: pad - minX,
    offsetY: pad - minY,
  };
}

/** Find, mutate helpers. Callers must supply a fresh cloned root. */
export function cloneTree(n: TreeNode): TreeNode {
  return { ...n, branch: { ...n.branch }, children: n.children.map(cloneTree) };
}

export function findNode(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}

export function findParent(root: TreeNode, id: string): TreeNode | null {
  for (const c of root.children) {
    if (c.id === id) return root;
    const f = findParent(c, id);
    if (f) return f;
  }
  return null;
}

export function nodeDepth(root: TreeNode, id: string, d = 0): number {
  if (root.id === id) return d;
  for (const c of root.children) {
    const r = nodeDepth(c, id, d + 1);
    if (r >= 0) return r;
  }
  return -1;
}

export function maxDepth(n: TreeNode): number {
  if (n.children.length === 0) return 0;
  return 1 + Math.max(...n.children.map(maxDepth));
}
