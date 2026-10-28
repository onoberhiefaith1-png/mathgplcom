// Layout solver — turns (layout, relations, numSets) into concrete circle
// centres. Manually-placed circles are preserved; everything else is
// auto-arranged so a teacher never has to line things up by hand.

import type { UCEVennModel, VennSet, SetId } from "./types";

interface Placed { A: VennSet; B: VennSet; C?: VennSet }

export function solveLayout(model: UCEVennModel): Placed {
  const { width: W, height: H } = model;
  const cy = H / 2;
  const A = getSet(model, "A")!;
  const B = getSet(model, "B")!;
  const C = model.numSets === 3 ? getSet(model, "C")! : undefined;

  const rA = A.radius, rB = B.radius, rC = C?.radius ?? 0;

  // Preset-driven overlap distances.
  const overlap = (r1: number, r2: number, kind: "intersect" | "disjoint" | "kiss") => {
    if (kind === "disjoint") return r1 + r2 + Math.max(14, (r1 + r2) * 0.15);
    if (kind === "kiss") return r1 + r2;
    return (r1 + r2) * 0.65; // classic intersect
  };

  const layout = model.layout;
  const rel = model.relations;

  const isTwo = model.numSets === 2;

  if (isTwo) {
    const kind = layout === "twoDisjoint" || (layout === "custom" && !rel.AB)
      ? "disjoint" : "intersect";
    const d = overlap(rA, rB, kind);
    return {
      A: place(A, W / 2 - d / 2, cy),
      B: place(B, W / 2 + d / 2, cy),
    };
  }

  // 3 sets
  if (layout === "threeAll" || layout === "custom" && rel.AB && rel.AC && rel.BC) {
    return threeCircleVenn(A, B, C!, W, H);
  }
  if (layout === "threeAllDisjoint" || (layout === "custom" && !rel.AB && !rel.AC && !rel.BC)) {
    const gap = 20;
    const dA = W / 2 - rA - rB - gap;
    const dC = W / 2 + rB + rC + gap;
    return {
      A: place(A, dA, cy),
      B: place(B, W / 2, cy),
      C: place(C!, dC, cy),
    };
  }
  if (layout === "threeChain" || (layout === "custom" && rel.AB && rel.BC && !rel.AC)) {
    const dAB = overlap(rA, rB, "intersect");
    const dBC = overlap(rB, rC, "intersect");
    // ensure A and C don't touch: enforce total width >= rA + rC + gap
    const total = dAB + dBC;
    const minTotal = rA + rC + 30;
    const scale = total < minTotal ? minTotal / total : 1;
    const AB = dAB * scale;
    const BC = dBC * scale;
    const centreB = W / 2;
    return {
      A: place(A, centreB - AB, cy),
      B: place(B, centreB, cy),
      C: place(C!, centreB + BC, cy),
    };
  }
  if (layout === "threeOneDisjoint" || (layout === "custom" && rel.AB && !rel.AC && !rel.BC)) {
    const dAB = overlap(rA, rB, "intersect");
    const gap = 24;
    const cxA = W / 2 - dAB / 2 - 20;
    const cxB = W / 2 + dAB / 2 - 20;
    const cxC = Math.max(cxB + rB + rC + gap, W * 0.75);
    return {
      A: place(A, cxA, cy),
      B: place(B, cxB, cy),
      C: place(C!, cxC, cy),
    };
  }

  // Fallback custom cases (mixed):
  //   AB=true, AC=true, BC=false  → A intersects B and C, but B and C are apart
  //   AB=false, AC=true, BC=true  → mirror
  //   AB=true,  BC=true, AC=false already handled (chain)
  if (layout === "custom") {
    if (rel.AB && rel.AC && !rel.BC) {
      // A centre, B left, C right, both intersecting A but not each other
      const dAB = overlap(rA, rB, "intersect");
      const dAC = overlap(rA, rC, "intersect");
      // ensure B and C don't overlap
      const need = rB + rC + 24;
      const totalOffset = dAB + dAC;
      const scale = totalOffset < need ? need / totalOffset : 1;
      return {
        A: place(A, W / 2, cy),
        B: place(B, W / 2 - dAB * scale, cy),
        C: place(C!, W / 2 + dAC * scale, cy),
      };
    }
    if (!rel.AB && rel.AC && rel.BC) {
      // C centre, A left, B right (mirror of above)
      const dAC = overlap(rA, rC, "intersect");
      const dBC = overlap(rB, rC, "intersect");
      const need = rA + rB + 24;
      const totalOffset = dAC + dBC;
      const scale = totalOffset < need ? need / totalOffset : 1;
      return {
        A: place(A, W / 2 - dAC * scale, cy),
        B: place(B, W / 2 + dBC * scale, cy),
        C: place(C!, W / 2, cy),
      };
    }
    if (rel.AB && !rel.AC && !rel.BC) {
      // covered above (threeOneDisjoint path). Repeat for safety.
    }
    if (!rel.AB && rel.AC && !rel.BC) {
      // A intersects C, B off to the side
      const dAC = overlap(rA, rC, "intersect");
      return {
        A: place(A, W / 2 - dAC / 2 - 10, cy),
        B: place(B, W / 2 - dAC - rA - rB - 30, cy),
        C: place(C!, W / 2 + dAC / 2 - 10, cy),
      };
    }
    if (!rel.AB && !rel.AC && rel.BC) {
      const dBC = overlap(rB, rC, "intersect");
      return {
        A: place(A, W / 2 + dBC + rB + rA + 30, cy),
        B: place(B, W / 2 - dBC / 2, cy),
        C: place(C!, W / 2 + dBC / 2, cy),
      };
    }
  }

  // default → three-circle Venn
  return threeCircleVenn(A, B, C!, W, H);
}

function threeCircleVenn(A: VennSet, B: VennSet, C: VennSet, W: number, H: number): Placed {
  const cx = W / 2;
  const cy = H / 2;
  const r = (A.radius + B.radius + C.radius) / 3;
  const d = r * 0.85; // distance from centroid to each centre
  const a = { x: cx - d * Math.sin(Math.PI / 3), y: cy + d / 2 };
  const b = { x: cx + d * Math.sin(Math.PI / 3), y: cy + d / 2 };
  const c = { x: cx, y: cy - d };
  return {
    A: place(A, a.x, a.y),
    B: place(B, b.x, b.y),
    C: place(C, c.x, c.y),
  };
}

function place(set: VennSet, x: number, y: number): VennSet {
  if (set.manualPlacement) return set;
  return { ...set, cx: x, cy: y };
}

function getSet(model: UCEVennModel, id: SetId): VennSet | undefined {
  return model.sets.find((s) => s.id === id);
}
