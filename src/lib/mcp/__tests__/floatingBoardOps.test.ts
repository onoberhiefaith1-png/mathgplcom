import { describe, expect, it } from "vitest";
import { applyFloatingOp, FLOATING_ACTIONS } from "@/lib/chatgpt/floatingBoardOps";

const LINES = [
  { lineId: "l1", fillers: ["x", "+", "2", "=", "0"] },
  { lineId: "l2", fillers: ["\\frac{1}{2}", "+", "3"] },
];

describe("applyFloatingOp", () => {
  it("deletes a chip and reindexes the line", () => {
    const r = applyFloatingOp(LINES, 1, "delete", { n: 2 });
    expect(r.ok && r.chips).toEqual(["x", "2", "=", "0"]);
    expect(r.ok && r.lines[1]).toEqual(LINES[1]);
  });
  it("moves a chip", () => {
    const r = applyFloatingOp(LINES, 1, "move", { from: 1, to: 3 });
    expect(r.ok && r.chips).toEqual(["+", "2", "x", "=", "0"]);
  });
  it("merges chips in order", () => {
    const r = applyFloatingOp(LINES, 1, "merge", { numbers: [1, 2, 3] });
    expect(r.ok && r.chips).toEqual(["x + 2", "=", "0"]);
  });
  it("keeps two symbols together", () => {
    const r = applyFloatingOp(LINES, 2, "keep_together", { a: "+", b: "3" });
    expect(r.ok).toBe(true);
  });
  it("rejects unknown chips, bad lines and empty data", () => {
    expect(applyFloatingOp(LINES, 1, "delete", { n: 9 }).ok).toBe(false);
    expect(applyFloatingOp(LINES, 5, "delete", { n: 1 }).ok).toBe(false);
    expect(applyFloatingOp([], 1, "delete", { n: 1 }).ok).toBe(false);
    expect(applyFloatingOp(LINES, 1, "merge", { numbers: [1] }).ok).toBe(false);
  });
  it("exposes exactly the whitelisted actions", () => {
    expect(FLOATING_ACTIONS).toEqual(["delete", "move", "merge", "keep_together"]);
  });
});
