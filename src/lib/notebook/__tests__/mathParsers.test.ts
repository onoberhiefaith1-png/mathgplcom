// Regression tests for the LaTeX brace/paren matchers.
//
// Bug being locked down: `matchBrace`/`matchParen` returned the index OF the
// closing delimiter while every call site assumed the index AFTER it. That
// dropped the last character of every group (`\sqrt{b^{2} − 4ac}` → "4a") and
// made `\frac` detection fail entirely, leaking raw LaTeX into lesson notes.

import { describe, it, expect } from "vitest";
import { latexToTree, treeToLatex } from "@/lib/smartboard/mathTreeLatex";
import { latexToFriendly } from "@/lib/notebook/mathFriendly";

const roundTrip = (v: string) => treeToLatex(latexToTree(v));

describe("latexToTree / treeToLatex round trip", () => {
  const cases = [
    // The exact formula that surfaced the bug.
    "\\frac{-b ± \\sqrt{b^{2} − 4ac}}{2a}",
    "x = \\frac{-b ± \\sqrt{b^{2} - 4ac}}{2a}",
    "\\frac{3\\sqrt{5}}{2\\sqrt{5} - 1}",
    "x^{2^{5^{n}}}",
    "\\sqrt[3]{x_{1}}",
    "x^{2} + 5x + 6 = 0",
    "\\frac{1}{2} + \\frac{3}{4}",
    "a_{1} + a_{2}",
  ];

  for (const v of cases) {
    it(`is lossless for ${v}`, () => {
      expect(roundTrip(v)).toBe(v);
    });
  }

  it("recognises \\frac as a fraction node, not literal text", () => {
    const tree = latexToTree("\\frac{a}{b}");
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe("frac");
  });

  it("keeps every character of a radicand", () => {
    expect(roundTrip("\\sqrt{4ac}")).toBe("\\sqrt{4ac}");
  });

  it("keeps a single-character exponent", () => {
    expect(roundTrip("b^{2}")).toBe("b^{2}");
  });
});

describe("latexToFriendly", () => {
  it("converts fractions without losing characters", () => {
    expect(latexToFriendly("\\frac{-b}{2a}")).toBe("(-b)/(2a)");
  });

  it("converts radicals without losing characters", () => {
    expect(latexToFriendly("\\sqrt{b^{2} - 4ac}")).toBe("√(b^2 - 4ac)");
  });

  it("converts the quadratic formula fully", () => {
    const out = latexToFriendly("\\frac{-b ± \\sqrt{b^{2} - 4ac}}{2a}");
    expect(out).toContain("4ac");
    expect(out).not.toContain("\\");
  });

  it("converts an indexed radical", () => {
    expect(latexToFriendly("\\sqrt[3]{27}")).toBe("³√(27)");
  });
});
