import { describe, expect, it } from "vitest";
import {
  hasPreparedFloating,
  planFloatingHydration,
  type FloatingCarrier,
} from "@/lib/lessonnotes/hydrateFloatingFromOrigin";

const prepared = (over: Partial<FloatingCarrier>): FloatingCarrier => ({
  id: "src",
  floating_lines: [{ fillers: ["2", "+", "2"] }],
  floating_bucket: { fillers: ["2", "+", "2"] },
  floating_highlights: [{ payload: "2+2" }],
  floating_scoring: null,
  ...over,
});

const empty = (over: Partial<FloatingCarrier>): FloatingCarrier => ({
  id: "tgt",
  floating_lines: [],
  floating_bucket: null,
  floating_highlights: [],
  floating_scoring: null,
  ...over,
});

describe("prepared floating detection", () => {
  it("treats empty arrays and null bucket as unprepared", () => {
    expect(hasPreparedFloating(empty({}))).toBe(false);
  });
  it("treats saved lines as prepared", () => {
    expect(hasPreparedFloating(prepared({}))).toBe(true);
  });
});

describe("planFloatingHydration", () => {
  it("matches on doc_key", () => {
    const patches = planFloatingHydration(
      [empty({ id: "t1", doc_key: "4:example:1" })],
      [prepared({ id: "s1", doc_key: "4:example:1" })],
    );
    expect(patches).toHaveLength(1);
    expect(patches[0].id).toBe("t1");
    expect(patches[0].floating_bucket).toEqual({ fillers: ["2", "+", "2"] });
  });

  it("falls back to stable_key", () => {
    const patches = planFloatingHydration(
      [empty({ id: "t1", doc_key: "x", stable_key: "k" })],
      [prepared({ id: "s1", doc_key: "y", stable_key: "k" })],
    );
    expect(patches.map((p) => p.id)).toEqual(["t1"]);
  });

  it("falls back to problem text", () => {
    const patches = planFloatingHydration(
      [empty({ id: "t1", problem: " Solve  2X + 2 = 6 " })],
      [prepared({ id: "s1", problem: "solve 2x + 2 = 6" })],
    );
    expect(patches.map((p) => p.id)).toEqual(["t1"]);
  });

  it("never overwrites a question that is already prepared", () => {
    const patches = planFloatingHydration(
      [prepared({ id: "t1", doc_key: "4:example:1" })],
      [prepared({ id: "s1", doc_key: "4:example:1" })],
    );
    expect(patches).toEqual([]);
  });

  it("consumes each source once, so numbers cannot be shared between questions", () => {
    const patches = planFloatingHydration(
      [
        empty({ id: "t1", problem: "same" }),
        empty({ id: "t2", problem: "same" }),
      ],
      [prepared({ id: "s1", problem: "same" })],
    );
    expect(patches.map((p) => p.id)).toEqual(["t1"]);
  });

  it("does nothing when the origin has no preparation", () => {
    expect(planFloatingHydration([empty({ id: "t1", doc_key: "a" })], [empty({ id: "s1", doc_key: "a" })])).toEqual([]);
  });
});
