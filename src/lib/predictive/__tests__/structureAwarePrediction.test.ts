import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { insertionPoints, predict, routeMapFor } from "../predictiveLine";
import { asciiWithCaret, joinedAsciiWithCaret } from "@/lib/smartboard/rowCaret";
import type { Node, Row } from "@/lib/smartboard/mathTree";

const c = (s: string): Row => [...s].map((ch) => ({ kind: "char", ch }) as Node);
const run = (expected: string, atoms: string[], student: string, caret?: number | null) =>
  predict({ routeMap: routeMapFor({ expectedAscii: expected, atoms, keyPrefix: `t:${Math.random()}` }), studentAscii: student, caret });

describe("structure-aware predictive line", () => {
  it("treats a placed square root as a container and predicts its inside", () => {
    const p = run("x = \\sqrt{b^2 - 4ac}", ["x", "=", "\\sqrt{}", "b^2", "-", "4ac"], "x = \\sqrt{b^2}");
    expect(p.status).toBe("incomplete");
    expect(p.remaining).toEqual(["-", "4ac"]);
    expect(p.predictive.replace(/\s+/g, "")).toBe("x=\\sqrt{b^2-4ac}");
    expect(p.complete).toBe(false);
  });

  it("fills an empty paired bracket instead of saying no route", () => {
    const p = run("y = (a + b)", ["y", "=", "(□)", "a", "+", "b"], "y = ()");
    expect(p.status).toBe("incomplete");
    expect(p.remaining).toEqual(["a", "+", "b"]);
    expect(p.predictive.replace(/\s+/g, "")).toBe("y=(a+b)");
  });

  it("nested containers: fraction inside a bracket", () => {
    const p = run("y = (\\frac{a}{b} + c)", ["y", "=", "(", ")", "\\frac{a}{b}", "+", "c"], "y = (\\frac{a}{b})");
    expect(p.status).toBe("incomplete");
    expect(p.remaining).toEqual(["+", "c"]);
  });

  it("never reports completion just because the closer is last", () => {
    const p = run("y = (a + b)", ["y", "=", "(□)", "a", "+", "b"], "y = (a)");
    expect(p.complete).toBe(false);
    expect(p.completionToken).toBe("b");
  });

  it("the caret wins first; outside the container it keeps writing after it", () => {
    expect(insertionPoints("y = (a)", 7)[0]).toBe(7);
    expect(insertionPoints("y = (a)", 6)[0]).toBe(6);
    const outside = run("y = (a) + b", ["y", "=", "(", ")", "a", "+", "b"], "y = (a)", 7);
    expect(outside.predictive.replace(/\s+/g, "")).toBe("y=(a)+b");
  });

  it("reroutes a reordered equation: A = 2 started from 2 predicts 2 = A", () => {
    const p = run("A = 2", ["A", "=", "2"], "2");
    expect(p.predictive).toBe("2 = A");
    expect(p.remaining).toEqual(["=", "A"]);
    expect(run("A = 2", ["A", "=", "2"], "2 = A").complete).toBe(true);
  });
});

describe("board caret reaches the predictor", () => {
  it("reports the cursor offset inside a bracket of a real math tree", () => {
    const row: Row = [...c("y="), { kind: "bracket", left: "(", right: ")", rows: [c("a")] } as Node];
    const out = asciiWithCaret(row, { path: [2, 0], index: 1 });
    expect(out.ascii[out.caret!]).toBe(")");
    const p = predict({
      routeMap: routeMapFor({ expectedAscii: "y = (a + b)", atoms: ["y", "=", "(□)", "a", "+", "b"], keyPrefix: "caret" }),
      studentAscii: out.ascii,
      caret: out.caret,
    });
    expect(p.remaining).toEqual(["+", "b"]);
  });

  it("joins multi-row lines with the caret offset of the live row", () => {
    const out = joinedAsciiWithCaret([{ row: c("x="), cursor: null }, { row: c("2"), cursor: { path: [], index: 1 } }]);
    expect(out).toEqual({ ascii: "x= 2", caret: 4 });
  });

  it("the Game line inspector passes the caret into predict()", () => {
    const src = readFileSync(resolve(__dirname, "../../../pages/imagine/ImaginePlayPage.tsx"), "utf8");
    expect(src).toMatch(/joinedAsciiWithCaret\(structuredLineMath/);
    expect(src).toMatch(/caret: studentAscii === boardStudentAscii \? boardLine\.caret : null/);
  });
});
