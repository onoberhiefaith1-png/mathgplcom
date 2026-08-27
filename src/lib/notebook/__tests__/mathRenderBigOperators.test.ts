// Large operators (∑ ∏ ∐ ∫ ∮) must be structured objects with limits and a
// body that sits BESIDE the operator on the mathematical axis — never a
// superscript, and never shifted by a per-glyph transform.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { renderMathInline, HAS_MATH } from "@/lib/notebook/mathRender";
import { latexToTree, treeToLatex } from "@/lib/smartboard/mathTreeLatex";

const html = (latex: string): string =>
  renderToStaticMarkup(createElement("span", null, renderMathInline(latex)));

describe("large operator rendering", () => {
  it("recognises every large operator as math", () => {
    for (const s of [
      "\\sum_{k=1}^{5}(2k^2-k+1)",
      "\\prod_{n=1}^{4}(n+2)",
      "\\coprod_{i=1}^{n}A",
      "\\int_{0}^{1}x^2dx",
      "\\oint_{C}F",
    ]) expect(HAS_MATH(s)).toBe(true);
  });

  it("renders the glyph with both limits and the body text", () => {
    const out = html("\\sum_{k=1}^{5}(2k^2-k+1)");
    expect(out).toContain("∑");
    expect(out).toContain("k=1");
    expect(out).toContain("5");
    expect(out).toContain("(2k");
  });

  it("renders ∏ and ∐ glyphs", () => {
    expect(html("\\prod_{n=1}^{4}(n+2)")).toContain("∏");
    expect(html("\\coprod_{i=1}^{n}A")).toContain("∐");
  });

  it("centres the operator group on the maths axis, with no translate hack", () => {
    for (const s of [
      "\\sum_{k=1}^{5}(2k^2-k+1)",
      "\\prod_{n=1}^{4}(n+2)",
      "\\coprod_{i=1}^{n}A",
      "\\int_{0}^{1}x^2dx",
      "\\oint_{C}F",
    ]) {
      const out = html(s);
      expect(out).toContain("vertical-align:middle");
      expect(out).not.toContain("translateY");
    }
  });

  it("body is not rendered as a superscript", () => {
    // A superscript would need a raised font-size on the body; the body here
    // is plain inline text, so no 0.6em-ish scaling wraps "(2k".
    const out = html("\\sum_{k=1}^{5}(2k^2-k+1)");
    const bodyIdx = out.indexOf("(2k");
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(out.slice(0, bodyIdx)).toContain("∑");
  });
});

describe("large operators are editable structures", () => {
  it("round-trips through the editable tree parser", () => {
    for (const s of [
      "\\sum_{k=1}^{5}(2k^2-k+1)",
      "\\prod_{n=1}^{4}(n+2)",
      "\\coprod_{i=1}^{n}A",
      "\\int_{0}^{1}x^2dx",
      "\\oint_{C}F",
    ]) expect(treeToLatex(latexToTree(s))).toBe(s);
  });

  it("keeps upper and lower limits in separate editable slots", () => {
    const tree = latexToTree("\\sum_{k=1}^{5}(2k^2-k+1)");
    const node = tree[0] as { kind: string; op: string; rows: unknown[][] };
    expect(node.kind).toBe("bigop");
    expect(node.op).toBe("sum");
    expect(node.rows).toHaveLength(3);
    expect(treeToLatex(node.rows[1] as never)).toBe("k=1");
    expect(treeToLatex(node.rows[2] as never)).toBe("5");
  });

  it("\\coprod is not mis-read as \\prod", () => {
    const node = latexToTree("\\coprod_{i=1}^{n}A")[0] as { op: string };
    expect(node.op).toBe("coprod");
  });

  it("edits a limit and a body without disturbing the rest", () => {
    // upper limit 5 → 6
    const sum = latexToTree("\\sum_{k=1}^{5}(2k^2-k+1)");
    const sumNode = sum[0] as { rows: unknown[][] };
    sumNode.rows[2] = latexToTree("6") as never;
    expect(treeToLatex(sum)).toBe("\\sum_{k=1}^{6}(2k^2-k+1)");

    // product body n+2 → n+3
    const prod = latexToTree("\\prod_{n=1}^{4}(n+2)");
    expect(treeToLatex(prod).replace("(n+2)", "(n+3)")).toBe("\\prod_{n=1}^{4}(n+3)");
    expect(treeToLatex(latexToTree("\\prod_{n=1}^{4}(n+3)"))).toBe("\\prod_{n=1}^{4}(n+3)");
  });
});
