import { describe, expect, it } from "vitest";
import { latexToTree, treeToLatex } from "../mathTreeLatex";
import { insertMathFragment } from "../insertMathFragment";
import { tokenizeCalculation, generateTableLines } from "@/lib/floating/tableGrid";

describe("subcell maths uses the regular cell tree", () => {
  it("inserts negative five inside a squared bracket at its caret", () => {
    const root = latexToTree("(□)^{2}");
    expect(root).toHaveLength(1);
    const shell = insertMathFragment([], { path: [], index: 0 }, root);
    const result = insertMathFragment(shell.root, shell.cursor, latexToTree("-5"));
    expect(treeToLatex(result.root)).toBe("(-5)^{2}");
  });
  it("keeps a fraction insertion inside a root and enters its numerator", () => {
    const root = insertMathFragment([], { path: [], index: 0 }, latexToTree("\\sqrt{□}"));
    const fraction = insertMathFragment(root.root, root.cursor, latexToTree("\\frac{□}{□}"));
    const result = insertMathFragment(fraction.root, fraction.cursor, latexToTree("12"));
    expect(treeToLatex(result.root)).toBe("\\sqrt{\\frac{12}{□}}");
  });
  it("does not change the previous snapshot when inserting a floating number", () => {
    const original = latexToTree("4-4");
    insertMathFragment(original, { path: [], index: 3 }, latexToTree("+5"));
    expect(treeToLatex(original)).toBe("4-4");
  });
  it("keeps existing caret chips usable as an exponent action", () => {
    const base = latexToTree("5");
    const power = insertMathFragment(base, { path: [], index: 1 }, latexToTree("^"));
    const result = insertMathFragment(power.root, power.cursor, latexToTree("2"));
    expect(treeToLatex(result.root)).toBe("5^{2}");
  });
  it("offers a separate square scaffold rather than a raw caret and exponent", () => {
    expect(tokenizeCalculation("5^{2}")).toEqual(["5", "□^{2}"]);
    expect(tokenizeCalculation("5^2")).toEqual(["5", "□^{2}"]);
    expect(tokenizeCalculation("5²")).toEqual(["5", "□^{2}"]);
  });
  it("offers nested root and fraction scaffolds rather than macro fragments", () => {
    const pieces = tokenizeCalculation("\\sqrt{\\frac{9}{4}}");
    expect(pieces).toEqual(["\\sqrt{□}", "\\frac{□}{□}", "9", "4"]);
  });
});
