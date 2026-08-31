import { describe, expect, it } from "vitest";
import {
  compileNavGraph,
  easeInOut,
  forwardFromYaw,
  layoutHallwayObjects,
  NavigationHistory,
  reverseHeading,
  segYaw,
  turnArc,
  turnHeading,
  turnaround,
  availableDirections,
  parentConnectionAnchor,
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
    expect(layoutHallwayObjects({ length: 40, doors: [], openings: [] })).toEqual([]);
  });

  it("alternates doors between the two walls", () => {
    const out = layoutHallwayObjects({ length: 40, doors: doors(4), openings: [] });
    expect(out.map((o) => o.side)).toEqual([-1, 1, -1, 1]);
  });

  it("keeps every object at its own distance, at least minGap apart", () => {
    const out = layoutHallwayObjects({ length: 60, doors: doors(5), openings: [], minGap: 4 });
    for (let i = 1; i < out.length; i++) {
      expect(out[i].along - out[i - 1].along).toBeGreaterThanOrEqual(4 - 1e-9);
    }
    expect(new Set(out.map((o) => o.along)).size).toBe(out.length);
  });

  it("puts openings on the wall their branch leaves through", () => {
    const out = layoutHallwayObjects({
      length: 40,
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
      length: 40,
      doors: [],
      openings: [{ id: "f", name: "More", direction: "forward", order: 0 }],
    });
    expect(out).toEqual([]);
  });

  it("never places two objects directly opposite each other", () => {
    const out = layoutHallwayObjects({
      length: 50,
      doors: doors(3),
      openings: [{ id: "l", name: "Left", direction: "left", order: 1 }],
    });
    const seen = new Map<number, number>();
    for (const o of out) {
      expect(seen.get(o.along)).toBeUndefined();
      seen.set(o.along, o.side);
    }
  });

  it("stays inside the corridor", () => {
    const out = layoutHallwayObjects({ length: 20, doors: doors(6), openings: [] });
    for (const o of out) {
      expect(o.along).toBeGreaterThan(0);
      expect(o.along).toBeLessThanOrEqual(20);
    }
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

  it("starts children at the parent's end and turns the heading", () => {
    const g = compileNavGraph([
      walkway("root", { length: 5 }),
      walkway("l", { parent_id: "root", direction: "left" }),
    ]);
const l = g.byId.get("l");
    expect(l?.start).toEqual([0, -5]);
    // facing forward (0,-1), "left" is the player's left → (-1,0)
    const turned = turnHeading([0, -1], "left");
    expect(turned[0]).toBeCloseTo(-1);
    expect(turned[1]).toBeCloseTo(0);
    expect(l?.heading).toEqual(turned);
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
    const root = walkway({ id: "a", parent_id: null, direction: "forward", length: 40 });
    const left = walkway({ id: "b", parent_id: "a", direction: "left", junction_at: 0.25 });
    const g = compileNavGraph([root, left]);
    const node = g.byId.get("b")!;
    // root runs down -z from the origin; a quarter along 40 units is z = -10
    expect(node.start[1]).toBeCloseTo(-10, 5);
  });

  it("only offers left and right as free branch directions", () => {
    const root = walkway({ id: "a", parent_id: null, direction: "forward" });
    expect(freeBranchDirections([root], "a")).toEqual(["left", "right"]);
    const left = walkway({ id: "b", parent_id: "a", direction: "left" });
    expect(freeBranchDirections([root, left], "a")).toEqual(["right"]);
  });
});
