import { describe, it, expect } from "vitest";
import { renderMathInline } from "@/lib/notebook/mathRender";

describe("inline math wrapping", () => {
  it("inserts break opportunities between top-level pieces", () => {
    const nodes = renderMathInline("x = (-b ± \\sqrt{b^2-4ac})/(2a)", "t") as any[];
    const wbrs = nodes.filter((n) => n && n.type === "wbr");
    expect(wbrs.length).toBeGreaterThan(0);
  });
  it("leaves a single piece untouched", () => {
    const nodes = renderMathInline("x", "t") as any[];
    expect(nodes.filter((n) => n && n.type === "wbr").length).toBe(0);
  });
});
