import { describe, expect, it } from "vitest";
import {
  compileNavGraph,
  easeInOut,
  forwardFromYaw,
  layoutHallwayObjects,
  hallwayLength,
  NavigationHistory,
  reverseHeading,
  segYaw,
  turnArc,
  turnHeading,
  turnaround,
  availableDirections,
  parentConnectionAnchor,
  lengthForObjects,
  freeBranchDirections,
  branchHeading,
  BRANCH_ANGLE,
  nextBranchDirection,
  nextObjectOffset,
  openingFootprint,
  junctionGeometry,
  WALL_THICKNESS,
  wallRuns,
} from "../building/navigation";

import type { BuildingWalkway } from "../building/types";

const walkway = (id: string, over: Partial<BuildingWalkway> = {}): BuildingWalkway => ({
  id,
  building_id: "b1",
  parent_id: null,
  name: "Main Hallway",
  end_label: null,
  direction: "forward",
  junction_at: 0.5,

  length: 10,
  position: 0,
  created_at: "",
  updated_at: "",
  ...over,
});

describe("layoutHallwayObjects", () => {
  const doors = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `d${i}`, name: `Door ${i}`, order: i }));

  it("returns nothing for an empty hallway", () => {
    expect(layoutHallwayObjects({ doors: [], openings: [] })).toEqual([]);
  });

  it("alternates doors between the two walls", () => {
    const out = layoutHallwayObjects({ doors: doors(4), openings: [] });
    expect(out.map((o) => o.side)).toEqual([-1, 1, -1, 1]);
  });

  it("keeps a fixed distance between consecutive objects", () => {
    const out = layoutHallwayObjects({ doors: doors(5), openings: [], spacing: 6 });
    for (let i = 1; i < out.length; i++) {
      expect(out[i].along - out[i - 1].along).toBeCloseTo(6);
    }
    expect(new Set(out.map((o) => o.along)).size).toBe(out.length);
  });

  it("puts openings on the wall their branch leaves through", () => {
    const out = layoutHallwayObjects({
      doors: [],
      openings: [
        { id: "l", name: "Algebra Hallway", direction: "left", order: 0 },
        { id: "r", name: "Geometry Hallway", direction: "right", order: 1 },
      ],
    });
    expect(out.map((o) => [o.id, o.side])).toEqual([
      ["l", -1],
      ["r", 1],
    ]);
  });

  it("ignores forward children (the hallway continuing)", () => {
    const out = layoutHallwayObjects({
      doors: [],
      openings: [{ id: "f", name: "More", direction: "forward", order: 0 }],
    });
    expect(out).toEqual([]);
  });

  it("keeps a clear slot between a door and a hallway opening", () => {
    const out = layoutHallwayObjects({
      doors: doors(3),
      openings: [{ id: "l", name: "Left", direction: "left", order: 1 }],
      spacing: 6,
    });
    const door = out.find((o) => o.id === "d1")!;
    const opening = out.find((o) => o.kind === "opening")!;
    expect(Math.abs(opening.along - door.along)).toBeGreaterThanOrEqual(12 - 1e-9);
  });

  it("places connections to other hallways as navigable mouths", () => {
    const out = layoutHallwayObjects({
      doors: [],
      openings: [],
      links: [{ id: "k1", name: "West Hallway", targetWalkwayId: "w9", order: 0 }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("link");
    expect(out[0].targetWalkwayId).toBe("w9");
  });

  it("grows the road as objects are added", () => {
    const short = layoutHallwayObjects({ doors: doors(2), openings: [] });
    const long = layoutHallwayObjects({ doors: doors(8), openings: [] });
    expect(hallwayLength(long)).toBeGreaterThan(hallwayLength(short));
    for (const o of long) expect(o.along).toBeLessThan(hallwayLength(long));
  });
});

describe("compileNavGraph", () => {
  it("compiles a single root walkway", () => {
    const g = compileNavGraph([walkway("root")]);
    expect(g.rootId).toBe("root");
    expect(g.nodes).toHaveLength(1);
    expect(g.byId.get("root")?.start).toEqual([0, 0]);
    expect(g.byId.get("root")?.heading).toEqual([0, -1]);
  });

  it("orders children by stored position", () => {
    const g = compileNavGraph([
      walkway("root"),
      walkway("right", { parent_id: "root", direction: "right", position: 1 }),
      walkway("left", { parent_id: "root", direction: "left", position: 0 }),
    ]);
    const kids = g.childrenByParent.get("root") ?? [];
    expect(kids.map((k) => k.direction)).toEqual(["left", "right"]);
  });

  it("starts a branch at its junction on the parent and turns the heading", () => {
    const g = compileNavGraph([
      walkway("root", { length: 5 }),
      walkway("l", { parent_id: "root", direction: "left" }),
    ]);
const l = g.byId.get("l");
    // junction_at 0.5 of a 5-unit road → halfway along, not at the far end
    expect(l?.start).toEqual([0, -2.5]);

    // A hallway leaves its parent at 60°, not square on, so both roads are
    // visible from the junction at once.
    const turned = branchHeading([0, -1], "left");
    expect(turned[0]).toBeCloseTo(-Math.sin(BRANCH_ANGLE));
    expect(turned[1]).toBeCloseTo(-Math.cos(BRANCH_ANGLE));
    expect(l?.heading[0]).toBeCloseTo(turned[0]);
    expect(l?.heading[1]).toBeCloseTo(turned[1]);
  });

  it("handles nested branches (depth increases)", () => {
    const g = compileNavGraph([
      walkway("root"),
      walkway("l", { parent_id: "root", direction: "left" }),
      walkway("ll", { parent_id: "l", direction: "right" }),
    ]);
    expect(g.byId.get("l")?.depth).toBe(1);
    expect(g.byId.get("ll")?.depth).toBe(2);
    expect(g.childrenByParent.get("l")?.[0].id).toBe("ll");
  });
});

describe("availableDirections", () => {
  it("reports only real children", () => {
    const g = compileNavGraph([
      walkway("root"),
      walkway("l", { parent_id: "root", direction: "left" }),
      walkway("r", { parent_id: "root", direction: "right" }),
    ]);
    const a = availableDirections(g, "root");
    expect(a).toEqual({ forward: false, left: true, right: true, back: false });
  });

  it("a leaf has no valid directions", () => {
    const g = compileNavGraph([walkway("root"), walkway("l", { parent_id: "root", direction: "left" })]);
    expect(availableDirections(g, "l")).toEqual({
      forward: false,
      left: false,
      right: false,
      back: true,
    });
  });
});

describe("turn geometry", () => {
  it("segYaw/forwardFromYaw are inverses", () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 1.2]) {
      const [x, z] = forwardFromYaw(yaw);
      expect(segYaw([x, z])).toBeCloseTo(yaw);
    }
  });

  it("reverseHeading flips a heading", () => {
    const h = forwardFromYaw(1.2);
    const r = reverseHeading(h);
    expect(r[0]).toBeCloseTo(-h[0]);
    expect(r[1]).toBeCloseTo(-h[1]);
  });

  it("turnArc sweeps exactly 90°", () => {
    const arc = turnArc([0, -1], turnHeading([0, -1], "right"), [0, -10]);
    expect(arc.fromYaw).toBeCloseTo(0);
    expect(arc.toYaw).toBeCloseTo(-Math.PI / 2);
    expect(arc.pivot).toEqual([0, -10]);
  });

  it("turnaround is exactly 180° in place", () => {
    const arc = turnaround([0, -1], [2, 3]);
    expect(arc.toYaw - arc.fromYaw).toBeCloseTo(Math.PI);
    expect(arc.pivot).toEqual([2, 3]);
  });

  it("easeInOut is monotonic and bounded", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBe(0.5);
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.1) {
      const v = easeInOut(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("NavigationHistory", () => {
  it("pushes, pops and keeps the root-first path", () => {
    const h = new NavigationHistory();
    h.push("root");
    h.push("left");
    h.push("right");
    expect(h.path).toEqual(["root", "left", "right"]);
    expect(h.peek()).toBe("right");
    expect(h.pop()).toBe("right");
    expect(h.path).toEqual(["root", "left"]);
    h.clear();
    expect(h.length).toBe(0);
  });
});
describe("parentConnectionAnchor", () => {
  it("marks the way back a short inset into the hallway, facing back", () => {
    const a = parentConnectionAnchor([0, 0], [0, -1], 2);
    expect(a.position).toEqual([0, -2]);
    expect(a.yaw).toBeCloseTo(Math.PI);
  });

  it("works for a hallway that turned right", () => {
    const heading = turnHeading([0, -1], "right");
    const a = parentConnectionAnchor([0, -10], heading, 3);
    expect(a.position[0]).toBeCloseTo(3);
    expect(a.position[1]).toBeCloseTo(-10);
    // the sign faces back along the hallway, i.e. the reverse heading
    expect(a.yaw).toBeCloseTo(segYaw(reverseHeading(heading)));
  });
});

describe("hallway roads and junctions", () => {
  it("grows a hallway automatically as objects are added", () => {
    expect(lengthForObjects(1)).toBeLessThan(lengthForObjects(4));
    expect(lengthForObjects(6)).toBeLessThan(lengthForObjects(10));
  });

  it("places a branch at its junction along the parent, not at the far end", () => {
    const root = walkway("a", { parent_id: null, direction: "forward", length: 40 });
    const left = walkway("b", { parent_id: "a", direction: "left", junction_at: 0.25 });
    const g = compileNavGraph([root, left]);
    const node = g.byId.get("b")!;
    // root runs down -z from the origin; a quarter along 40 units is z = -10
    expect(node.start[1]).toBeCloseTo(-10, 5);
  });

  it("keeps both sides available however many branches a road already has", () => {
    const root = walkway("a", { parent_id: null, direction: "forward" });
    expect(freeBranchDirections([root], "a")).toEqual(["left", "right"]);
    const left = walkway("b", { parent_id: "a", direction: "left" });
    expect(freeBranchDirections([root, left], "a")).toEqual(["left", "right"]);
  });
});

describe("hallway junctions are automatic and physical", () => {
  it("alternates the side of each new branch: right, left, right", () => {
    const ws: BuildingWalkway[] = [walkway("root")];
    expect(nextBranchDirection(ws, "root")).toBe("right");
    ws.push(walkway("a", { parent_id: "root", direction: "right" }));
    expect(nextBranchDirection(ws, "root")).toBe("left");
    ws.push(walkway("b", { parent_id: "root", direction: "left" }));
    expect(nextBranchDirection(ws, "root")).toBe("right");
  });

  it("places each new object after everything already on the road", () => {
    expect(nextObjectOffset([])).toBeCloseTo(0.02);
    expect(nextObjectOffset([0.16, 0.32])).toBeCloseTo(0.34);
    expect(nextObjectOffset([0.999])).toBeCloseTo(0.999);
  });

  it("breaks the wall into runs either side of a cut-through", () => {
    const foot = openingFootprint(10);
    expect(foot.width).toBeGreaterThan(3);
    const runs = wallRuns(0, 40, [{ along: 20, width: foot.width }]);
    expect(runs.length).toBe(2);
    expect(runs[0][1]).toBeCloseTo(20 - foot.width / 2);
    expect(runs[1][0]).toBeCloseTo(20 + foot.width / 2);
  });

  it("keeps a solid wall when the hallway has no junctions", () => {
    expect(wallRuns(0, 30, [])).toEqual([[0, 30]]);
  });

  it("solves a 60 degree junction as two corridor volumes meeting", () => {
    const w = 7;
    const geo = junctionGeometry(w);
    // A diagonal corridor crosses the wall over width / sin(theta)
    expect(geo.mouthSpan).toBeCloseTo(w / Math.sin(BRANCH_ANGLE));
    expect(geo.mouthSpan).toBeGreaterThan(w);
    // ...and the mouth centre sits forward of the junction point
    expect(geo.mouthCenterOffset).toBeCloseTo((w / 2) * (Math.cos(BRANCH_ANGLE) / Math.sin(BRANCH_ANGLE)));
    // The branch shell begins clear of the parent corridor
    const clearance = geo.branchTrim * Math.sin(BRANCH_ANGLE) - (w / 2) * Math.cos(BRANCH_ANGLE);
    expect(clearance).toBeGreaterThanOrEqual(w / 2 - 1e-9);
    // Mouth edges lie on the parent wall plane; the throat corner is beyond it
    expect(geo.mouthNear[0]).toBeCloseTo(w / 2);
    expect(geo.mouthFar[0]).toBeCloseTo(w / 2);
    expect(geo.throatCorner[0]).toBeGreaterThan(w / 2);
    expect(geo.wallThickness).toBe(WALL_THICKNESS);
  });

  it("stops the parent wall either side of the diagonal mouth", () => {
    const geo = junctionGeometry(7);
    const center = 20 + geo.mouthCenterOffset;
    const runs = wallRuns(0, 60, [{ along: center, width: geo.mouthSpan }]);
    expect(runs.length).toBe(2);
    expect(runs[0][1]).toBeCloseTo(center - geo.mouthSpan / 2);
    expect(runs[1][0]).toBeCloseTo(center + geo.mouthSpan / 2);
    // no run overlaps the mouth
    for (const [a, b] of runs) {
      expect(b <= center - geo.mouthSpan / 2 + 1e-6 || a >= center + geo.mouthSpan / 2 - 1e-6).toBe(true);
    }
  });

  it("branches right at -60 degrees from the road", () => {
    const h = branchHeading([0, -1], "right");
    expect(h[0]).toBeCloseTo(Math.sin(BRANCH_ANGLE));
    expect(h[1]).toBeCloseTo(-Math.cos(BRANCH_ANGLE));
  });
});
