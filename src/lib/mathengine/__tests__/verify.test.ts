import { describe, expect, it } from "vitest";
import { checkClaim } from "../verify";

describe("Math Engine claim verification — exact-first, not float+tolerance", () => {
  it("passes a genuinely correct linear root", () => {
    expect(
      checkClaim({ kind: "linear_root", a: 2, b: -12, root: "6" }).ok,
    ).toBe(true);
  });

  it("rejects a genuinely wrong linear root", () => {
    const result = checkClaim({ kind: "linear_root", a: 2, b: -12, root: "5" });
    expect(result.ok).toBe(false);
  });

  it("rejects a quadratic root stated as a close-but-inexact decimal", () => {
    // Regression test: the old float+1e-4-relative-tolerance check let this
    // through as "verified" even though 2 (not 2.0001) is the true root.
    const result = checkClaim({
      kind: "quadratic_roots",
      a: 1,
      b: -5,
      c: 6,
      roots: ["2.0001", "3"],
    });
    expect(result.ok).toBe(false);
  });

  it("passes exact quadratic roots", () => {
    expect(
      checkClaim({
        kind: "quadratic_roots",
        a: 1,
        b: -5,
        c: 6,
        roots: ["2", "3"],
      }).ok,
    ).toBe(true);
  });

  it("passes a correct arithmetic claim", () => {
    expect(
      checkClaim({ kind: "arithmetic", expression: "(3+4)×5", value: "35" }).ok,
    ).toBe(true);
  });

  it("checks a cubic equation — a shape the old 4 claim kinds could never verify", () => {
    expect(
      checkClaim({
        kind: "equation_solution",
        equation: "x^3-8=0",
        variable: "x",
        value: "2",
      }).ok,
    ).toBe(true);
    expect(
      checkClaim({
        kind: "equation_solution",
        equation: "x^3-8=0",
        variable: "x",
        value: "3",
      }).ok,
    ).toBe(false);
  });

  it("checks a trigonometric equation in degrees", () => {
    expect(
      checkClaim({
        kind: "equation_solution",
        equation: "sin(x)=0.5",
        variable: "x",
        value: "30",
      }).ok,
    ).toBe(true);
  });

  it("flags an irrational value written as a rounded decimal instead of exact form", () => {
    const result = checkClaim({
      kind: "equation_solution",
      equation: "x^2=3",
      variable: "x",
      value: "1.7320508",
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/exact/i);
  });

  it("does not flag a short, clean decimal as needing exact form", () => {
    expect(
      checkClaim({
        kind: "equation_solution",
        equation: "2*x=1",
        variable: "x",
        value: "0.5",
      }).ok,
    ).toBe(true);
  });

  it("still allows kind: none for genuinely non-numeric content", () => {
    expect(checkClaim({ kind: "none" }).ok).toBe(true);
  });
});
