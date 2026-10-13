import { describe, expect, it } from "vitest";
import { createLabConsole } from "../console";

const out = (r: ReturnType<ReturnType<typeof createLabConsole>["run"]>) =>
  r.entries.filter((e) => e.type === "out").map((e) => e.text).join("\n");

describe("Math Lab console", () => {
  it("evaluates arithmetic and stores ans", () => {
    const c = createLabConsole();
    const r = c.run("2 + 3 * 4");
    expect(out(r)).toContain("ans =");
    expect(out(r)).toContain("14");
  });

  it("assigns variables and reuses them", () => {
    const c = createLabConsole();
    c.run("x = 5");
    const r = c.run("x^2 + 1");
    expect(out(r)).toContain("26");
  });

  it("creates matrices and computes determinants", () => {
    const c = createLabConsole();
    c.run("A = [1 2; 3 4]");
    const r = c.run("det(A)");
    expect(out(r)).toContain("-2");
  });

  it("multiplies matrices", () => {
    const c = createLabConsole();
    c.run("A = [1 2; 3 4]");
    c.run("B = [5 6; 7 8]");
    const r = c.run("A * B");
    expect(out(r)).toContain("19");
    expect(out(r)).toContain("50");
  });

  it("inverts a matrix", () => {
    const c = createLabConsole();
    c.run("A = [2 0; 0 4]");
    const r = c.run("inv(A)");
    expect(out(r)).toContain("0.5");
    expect(out(r)).toContain("0.25");
  });

  it("plot command returns the equation to plot", () => {
    const c = createLabConsole();
    const r = c.run("plot y = x^2");
    expect(r.plot).toBe("y = x^2");
  });

  it("who lists variables, clear empties the workspace", () => {
    const c = createLabConsole();
    c.run("a = 1");
    expect(out(c.run("who"))).toContain("a");
    c.run("clear");
    expect(out(c.run("who"))).toContain("empty");
  });

  it("reports errors without throwing", () => {
    const c = createLabConsole();
    const r = c.run("det(");
    expect(r.entries.some((e) => e.type === "err")).toBe(true);
  });
});
