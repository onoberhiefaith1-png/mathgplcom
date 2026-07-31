// Regression tests for the LaTeX brace/paren matchers.
//
// Bug being locked down: `matchBrace`/`matchParen` returned the index OF the
// closing delimiter while every call site assumed the index AFTER it. That
// dropped the last character of every group (`\sqrt{b^{2} − 4ac}` → "4a") and
// made `\frac` detection fail entirely, leaking raw LaTeX into lesson notes.

import { describe, it, expect } from "vitest";
import { latexToTree, treeToLatex } from "@/lib/smartboard/mathTreeLatex";
import { latexToFriendly } from "@/lib/notebook/mathFriendly";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";

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

// The Smartboard editor must be able to represent everything the classroom
// renderer (and therefore the AI Edit preview) can display. Anything missing
// here used to leak as raw backslash text into the note.
describe("advanced constructs round trip", () => {
  const cases = [
    "\\sum_{i=1}^{n}",
    "\\prod_{k=0}^{m}",
    "\\int_{0}^{1}",
    "\\lim_{x \\to 0}",
    "\\bar{x}",
    "\\vec{v}",
    "\\hat{y}",
    "\\binom{n}{r}",
    "|x_{i} - \\bar{x}|",
    "\\floor{x}",
    "\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}",
    // Mean deviation — the formula from the bug report.
    "\\frac{\\sum_{i=1}^{n}|x_{i} - \\bar{x}|}{n}",
  ];
  for (const c of cases) {
    it(`preserves ${c}`, () => {
      expect(roundTrip(c).replace(/\s+/g, "")).toBe(c.replace(/\s+/g, ""));
    });
  }

  it("keeps the big-operator structure instead of literal text", () => {
    const tree = latexToTree("\\sum_{i=1}^{n}");
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe("bigop");
  });

  it("keeps the accent structure", () => {
    const tree = latexToTree("\\bar{x}");
    expect(tree[0].kind).toBe("accent");
  });
});

// Display standard: normalizing then serialising must be stable, so the
// string AI Edit renders is byte-identical to the string the lesson-note
// node renders.
describe("normalize → serialise stability", () => {
  const cases = [
    "\\frac{\\sum_{i=1}^{n}|x_{i} - \\bar{x}|}{n}",
    "\\frac{1}{\\frac{a}{b} + c}",
    "\\sum_{i=1}^{n} x_{i}^{2}",
  ];
  for (const c of cases) {
    it(`is stable for ${c}`, () => {
      const once = normalizeMathSource(c);
      expect(normalizeMathSource(once)).toBe(once);
      expect(treeToLatex(latexToTree(once)).replace(/\s+/g, "")).toBe(
        once.replace(/\s+/g, ""),
      );
    });
  }
});
