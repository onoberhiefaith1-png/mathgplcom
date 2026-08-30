import { describe, expect, it } from "vitest";
import {
  compileNavGraph,
  easeInOut,
  forwardFromYaw,
  NavigationHistory,
  reverseHeading,
  segYaw,
  turnArc,
  turnHeading,
  turnaround,
  availableDirections,
} from "../building/navigation";
import type { BuildingWalkway } from "../building/types";

const walkway = (id: string, over: Partial<BuildingWalkway> = {}): BuildingWalkway => ({
  id,
  building_id: "b1",
  parent_id: null,
  direction: "forward",
  length: 10,
  position: 0,
  created_at: "",
  updated_at: "",
  ...over,
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