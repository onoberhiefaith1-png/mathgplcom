import { describe, it, expect } from "vitest";
import { deriveSubcells } from "./deriveSubcells";
describe("deriveSubcells", () => {
  it("football goals", () => {
    const s = deriveSubcells(["x","f","fx","x^{2}","fx^{2}"], [["0","3","0","0","0"],["2","4","8","4","16"],["4","1","4","16","16"]]);
    expect(s["1:2"].expr).toBe("4 × 2");
    expect(s["1:3"].expr).toBe("2^{2}");
    expect(s["1:4"].expr).toBe("4 × 4");
    expect(s["0:0"]).toBeUndefined();
    expect(s["0:1"]).toBeUndefined();
  });
  it("drops wrong working", () => {
    const s = deriveSubcells(["x","f","fx"], [["2","4","9"]]);
    expect(s["0:2"]).toBeUndefined();
  });
  it("data-only table has none", () => {
    expect(deriveSubcells(["x","f"], [["0","3"]])).toEqual({});
  });
});
