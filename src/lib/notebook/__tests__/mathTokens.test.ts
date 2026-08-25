import { describe, it, expect } from "vitest";
import { tokenizeMath } from "@/lib/notebook/mathTokens";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";

describe("tokenizeMath — structures are atomic", () => {
  it("keeps a bmatrix as one token", () => {
    const src = "A = \\begin{bmatrix}2 & 1 \\\\ 3 & 4\\end{bmatrix}";
    const t = tokenizeMath(src);
    expect(t).toEqual(["A", "=", "\\begin{bmatrix}2 & 1 \\\\ 3 & 4\\end{bmatrix}"]);
  });

  it("keeps a summation with bounds as one token", () => {
    const t = tokenizeMath("S = \\sum_{i = 1}^{n} i^{2}");
    expect(t[2]).toBe("\\sum_{i = 1}^{n}");
    expect(t.length).toBe(4);
  });

  it("keeps an integral with limits as one token", () => {
    const t = tokenizeMath("\\int_{0}^{1} x dx");
    expect(t[0]).toBe("\\int_{0}^{1}");
  });

  it("keeps a fraction nested inside a matrix cell", () => {
    const src = "\\begin{pmatrix}\\frac{1}{2} & 0\\end{pmatrix}";
    expect(tokenizeMath(src)).toEqual([src]);
  });

  it("keeps a \\left…\\right group together", () => {
    const t = tokenizeMath("\\left( a + b \\right) = c");
    expect(t[0]).toBe("\\left( a + b \\right)");
  });
});

describe("unicodeMath — structures survive normalisation", () => {
  it("does not strip the braces of a matrix environment", () => {
    const out = toUnicodeMath("\\begin{bmatrix}2 & 1 \\\\ 3 & 4\\end{bmatrix}");
    expect(out).toContain("\\begin{bmatrix}");
    expect(out).toContain("\\end{bmatrix}");
    expect(out).not.toContain("\\beginbmatrix");
  });

  it("treats a complete matrix / summation as clean classroom math", () => {
    expect(isStillDirty(toUnicodeMath("\\begin{bmatrix}1 & 2\\end{bmatrix}"))).toBe(false);
    expect(isStillDirty(toUnicodeMath("\\sum_{i=1}^{n}"))).toBe(false);
  });
});
