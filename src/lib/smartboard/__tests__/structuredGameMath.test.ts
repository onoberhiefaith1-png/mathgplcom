import { describe, expect, it } from "vitest";
import { gameMoveVertical } from "../gameSensor";
import { latexToTree, treeToLatex } from "../mathTreeLatex";
import { rowToAscii } from "../rowAscii";
import { cloneMathRow } from "@/lib/slate/structuredMath";

const expressions = [
  "x^{2}+3x+2",
  "x_{1}+x_{2}",
  "\\frac{3x}{5}",
  "\\sqrt{x+3}",
  "2(x+3)",
  "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}",
  "\\begin{pmatrix}1&2&3\\\\4&5&6\\\\7&8&9\\end{pmatrix}",
  "\\int_{0}^{1}x^{2}dx",
  "\\sum_{s=5}^{∞}s",
  "\\lim_{x→0}\\frac{sin x}{x}",
  "|x-3|",
  "\\frac{x^{2}}{x+1}",
  "x^{\\frac{1}{2}}",
  "(\\frac{x}{x+1})",
  "\\begin{cases}x^{2} & x≥0 \\\\ -x & x<0\\end{cases}",
  "\\sqrt{\\frac{x_{1}+x_{2}}{\\sum_{s=5}^{∞}s}}",
];

describe("Game structured mathematics", () => {
  it.each(expressions)("survives clone and save/reload: %s", (source) => {
    const tree = latexToTree(source);
    const cloned = cloneMathRow(tree);
    const reloaded = JSON.parse(JSON.stringify(cloned));
    expect(reloaded).toEqual(tree);
    expect(latexToTree(treeToLatex(reloaded))).toEqual(tree);
  });

  it("keeps the clean grading projection unchanged by cloning", () => {
    for (const source of expressions) {
      const tree = latexToTree(source);
      expect(rowToAscii(cloneMathRow(tree))).toBe(rowToAscii(tree));
    }
  });

  it("moves through piecewise rows without changing the Game Line", () => {
    const root = latexToTree("\\begin{cases}x & x≥0 \\\\ -x & x<0\\end{cases}");
    expect(gameMoveVertical(root, { path: [], index: 0 }, 1)).toEqual({ path: [0, 2], index: 2 });
    expect(gameMoveVertical(root, { path: [0, 2], index: 1 }, -1)).toEqual({ path: [0, 0], index: 1 });
  });
});