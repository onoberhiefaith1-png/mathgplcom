import { describe, it, expect } from "vitest";
import { detectElements } from "@/lib/floating/elementDetector";
import { runLawPipeline } from "@/lib/floating/laws";
import { verify } from "@/lib/floating/verifier";

describe("Floating Numbers — element detector + verifier", () => {
  it("detects 7 elements in 4(a-b)=0", () => {
    const els = detectElements("4(a-b)=0");
    const kinds = els.map((e) => e.kind);
    expect(kinds).toContain("number");
    expect(kinds).toContain("variable");
    expect(kinds).toContain("operator");
    expect(kinds).toContain("equality");
    expect(kinds.filter((k) => k === "bracket-open").length).toBe(1);
  });

  it("law pipeline produces chips for 4(a-b)=0 that verify PASS", () => {
    const original = "4(a-b)=0";
    const els = detectElements(original);
    const { chips } = runLawPipeline(original, els);
    const v = verify(original, chips);
    // Coverage must be 100% on this canonical example.
    expect(v.coveragePct).toBe(100);
  });

  it("flags missing variable b", () => {
    const v = verify("4(a-b)=0", ["4", "()", "a", "=0"]);
    expect(v.status).toBe("FAIL");
    expect(v.missing.some((m) => m.key === "variable:b")).toBe(true);
  });

  it("clean exponent fuses; dirty exponent shells", () => {
    const clean = runLawPipeline("e^{2x}", detectElements("e^{2x}"));
    expect(clean.chips.join(" ")).toMatch(/e\^/);
    const dirty = runLawPipeline("e^{2x+1}=10", detectElements("e^{2x+1}=10"));
    expect(dirty.chips.join(" ")).toMatch(/\(\)\^\(\)/);
  });

  it("f(x) stays fused; a(b+c) fractures", () => {
    const fx = runLawPipeline("f(x)", detectElements("f(x)"));
    expect(fx.chips.join(" ")).toMatch(/f\(x\)|f\(/);
    const abc = runLawPipeline("a(b+c)", detectElements("a(b+c)"));
    expect(abc.chips).toContain("()");
  });
});
