import { describe, expect, it } from "vitest";
import { extractUpscaleReport, verifyUpscale } from "../../../../supabase/functions/notebook-ai/upscaleVerifier";

describe("educational upscaling verifier", () => {
  it("extracts the report line", () => {
    const r = extractUpscaleReport('## Example 1\nSolve x+1=2\n[[upscale kept="1" completed="1" reconstructed="0" visuals="0" review=""]]');
    expect(r.report?.completed).toBe(1);
    expect(r.content).not.toContain("[[upscale");
  });

  it("flags a problem with no solution", () => {
    const d = verifyUpscale("## Example 1\nSolve 2x+3=7", "## Example 1\nSolve 2x+3=7", null);
    expect(d.some((x) => x.includes("no complete solution"))).toBe(true);
  });

  it("flags a replaced method", () => {
    const src = "## Example 1\nSolve 3x^2+4x+5=0 using the quadratic formula";
    const out = "## Example 1\nSolve 3x^2+4x+5=0\nFactorise\n(3x+..)\nx = ...";
    expect(verifyUpscale(src, out, null).some((x) => x.includes("quadratic formula"))).toBe(true);
  });

  it("flags dropped classwork items", () => {
    const src = "## Classwork 1\nSolve x^2-7x+10=0\n## Classwork 2\nSolve 2x^2-5x-3=0";
    const out = "## Classwork 1\nx^2-7x+10=0\n(x-5)(x-2)=0\nx=5 or x=2";
    expect(verifyUpscale(src, out, null).some((x) => x.includes("do not drop"))).toBe(true);
  });

  it("passes a complete, preserved upscale", () => {
    const src = "## Example 1\nSolve x^2-7x+10=0";
    const out = "## Example 1\nSolve x^2-7x+10=0\nx^2-7x+10=0\n(x-5)(x-2)=0\nx=5 or x=2";
    expect(verifyUpscale(src, out, null)).toEqual([]);
  });
});
