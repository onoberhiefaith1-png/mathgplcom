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

import { deriveSubcells as dsc, mergeWorkingTables } from "./deriveSubcells";
describe("deviation working", () => {
  it("x − x̄ and (x − x̄)² use mean and earlier answer", () => {
    const s = dsc(["x", "x - \\bar{x}", "(x - \\bar{x})^2"], [["80","0","0"],["85","5","25"],["70","-10","100"]]);
    expect(s["1:1"].expr).toBe("85 − 80");
    expect(s["1:2"].expr).toBe("5^{2}");
    expect(s["2:2"].expr).toBe("(-10)^{2}");
    expect(s["0:0"]).toBeUndefined();
  });
  it("merges a working table into the answer table", () => {
    const t = (cells: string[][]) => ({ type: "paragraph", content: [{ type: "mathVisual", attrs: { family: "smarttable", attrs: { rows: 2, cols: 2, cells, subcells: {} } } }] });
    const out = mergeWorkingTables([t([["80","85-80"],["70","70-80"]]), t([["80","5"],["70","-10"]])] as any);
    expect(out).toHaveLength(1);
    expect((out[0] as any).content[0].attrs.attrs.subcells["0:1"].expr).toBe("85-80");
  });
});

import { subcellViolations } from "./deriveSubcells";
describe("Subcell consistency standard", () => {
  it("acceptance table: X raw, every deviation row has working", () => {
    const h = ["X", "X - \\mu", "(X - \\mu)^2"];
    const g = [["5","-3","9"],["7","-1","1"],["8","0","0"],["10","2","4"],["10","2","4"]];
    const s = dsc(h, g, 8);
    for (let r = 0; r < 5; r++) { expect(s[`${r}:0`]).toBeUndefined(); expect(s[`${r}:1`]).toBeTruthy(); expect(s[`${r}:2`]).toBeTruthy(); }
    expect(s["0:1"].expr).toBe("5 − 8");
    expect(s["0:2"].expr).toBe("(-3)^{2}");
    expect(subcellViolations(h, g, s)).toEqual([]);
  });
  it("cumulative, relative, percentage, angle", () => {
    const h = ["x","f","cf","Relative frequency","Percentage","Angle"];
    const g = [["1","2","2","0.2","20","72"],["2","3","5","0.3","30","108"],["3","5","10","0.5","50","180"]];
    const s = dsc(h, g);
    expect(s["1:2"].expr).toBe("5 + 3".replace("5","2").replace("2 + 3","2 + 3"));
    expect(s["1:3"].expr).toBe("3 ÷ 10");
    expect(s["1:4"].expr).toBe("3 ÷ 10 × 100");
    expect(s["2:5"].expr).toBe("5 ÷ 10 × 360");
    expect(s["0:1"]).toBeUndefined();
  });
  it("table of values from a rule", () => {
    const s = dsc(["x","y = 2x + 1"], [["0","1"],["3","7"],["-1","-1"]]);
    expect(s["1:1"].expr).toBe("2 × (3)+1");
    expect(Object.keys(s)).toHaveLength(3);
  });
  it("flags a gapped column", () => {
    expect(subcellViolations(["x","f","fx"], [["1","2","2"],["2","3","7"]]).length).toBe(1);
  });
});
