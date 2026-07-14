// Optional auto-layout: places nodes in a horizontal / vertical / tree /
// radial arrangement based on edge order. "free" keeps stored coords.

import type { FlowModel, FlowNode } from "./types";

export function autoLayout(model: FlowModel): FlowModel {
  if (model.layout === "free" || model.nodes.length === 0) return model;
  const nodes = model.nodes.map((n) => ({ ...n }));
  const gapX = 60, gapY = 60;

  if (model.layout === "horizontal") {
    let x = 40;
    nodes.forEach((n) => { n.x = x; n.y = 100; x += n.w + gapX; });
  } else if (model.layout === "vertical") {
    let y = 40;
    nodes.forEach((n) => { n.x = 200; n.y = y; y += n.h + gapY; });
  } else if (model.layout === "tree" || model.layout === "radial") {
    // Simple BFS from node 0.
    const adj = new Map<string, string[]>();
    nodes.forEach((n) => adj.set(n.id, []));
    model.edges.forEach((e) => { adj.get(e.from)?.push(e.to); });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const rootId = nodes[0].id;
    const levels: string[][] = [[rootId]];
    const seen = new Set([rootId]);
    while (levels[levels.length - 1].length > 0) {
      const next: string[] = [];
      for (const id of levels[levels.length - 1]) {
        for (const c of adj.get(id) ?? []) {
          if (!seen.has(c)) { seen.add(c); next.push(c); }
        }
      }
      if (!next.length) break;
      levels.push(next);
    }
    if (model.layout === "tree") {
      levels.forEach((row, i) => {
        row.forEach((id, j) => {
          const n = byId.get(id)!;
          n.x = 40 + j * (n.w + gapX);
          n.y = 40 + i * (100 + gapY);
        });
      });
    } else {
      // radial
      const cx = 250, cy = 220;
      levels.forEach((row, i) => {
        if (i === 0) { const n = byId.get(row[0])!; n.x = cx - n.w / 2; n.y = cy - n.h / 2; return; }
        const r = 90 * i;
        row.forEach((id, j) => {
          const a = (2 * Math.PI * j) / row.length;
          const n = byId.get(id)!;
          n.x = cx + Math.cos(a) * r - n.w / 2;
          n.y = cy + Math.sin(a) * r - n.h / 2;
        });
      });
    }
  }

  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  return { ...model, nodes, canvas: { w: Math.max(520, maxX + 40), h: Math.max(340, maxY + 40) } };
}

export function nodeCentre(n: FlowNode): { cx: number; cy: number } {
  return { cx: n.x + n.w / 2, cy: n.y + n.h / 2 };
}
