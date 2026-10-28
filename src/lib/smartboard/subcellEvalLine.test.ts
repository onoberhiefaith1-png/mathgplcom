import { describe, it, expect } from "vitest";
import { subcellEvalLine } from "./tableActivity";
const g = { grid: { subcells: { "0:1": { expr: "2 − 6" } } } };
describe("subcellEvalLine", () => {
  it("active Subcell gives its expected line", () => {
    expect(subcellEvalLine(g, { "sub:0:1": "2-6" }, "sub:0:1")).toEqual({ key: "0:1", expected: "2 − 6", student: "2-6" });
  });
  it("normal cell returns to table feed", () => {
    expect(subcellEvalLine(g, {}, "0:1")).toBeNull();
  });
});
