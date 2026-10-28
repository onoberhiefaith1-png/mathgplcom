import { describe, expect, it } from "vitest";
import { mkChar, mkMatrix, insertNode, getRowAt, type Row, type Cursor } from "@/lib/smartboard/mathTree";
import { emptyMatrixLatex, matrixShellFromLatex } from "@/lib/floating/matrixChips";

/** Mirrors PresentationView.insertMatrixAtSensor: chip → EMPTY matrix node,
 *  cursor parked inside the first cell. */
const insertShell = (latex: string) => {
  const shell = matrixShellFromLatex(latex)!;
  const node = mkMatrix(shell.rows, shell.cols, shell.left || "(", shell.right || ")");
  return insertNode([], { path: [], index: 0 }, node, true);
};

describe("matrix insertion is structure-only", () => {
  it("inserts one matrix node with rows*cols EMPTY cells", () => {
    for (const [r, c] of [[2, 2], [2, 3], [3, 3], [4, 4]] as const) {
      const { root, cursor } = insertShell(emptyMatrixLatex(r, c));
      expect(root.length).toBe(1);
      const node = root[0] as any;
      expect(node.kind).toBe("matrix");
      expect(node.rows.length).toBe(r * c);
      expect(node.rows.every((row: Row) => row.length === 0)).toBe(true);
      // Cursor is inside the first cell of the matrix.
      expect(cursor.path).toEqual([0, 0]);
      expect(cursor.index).toBe(0);
    }
  });

  it("fills cells independently and sequentially (2, 1, 3, 4)", () => {
    let { root, cursor } = insertShell(emptyMatrixLatex(2, 2));
    const values = ["2", "1", "3", "4"];
    values.forEach((v, cell) => {
      const target: Cursor = { path: [0, cell], index: 0 };
      const res = insertNode(root, target, mkChar(v), false);
      root = res.root;
      cursor = res.cursor;
    });
    const node = root[0] as any;
    expect(node.rows.map((row: Row) => row.map((n: any) => n.ch).join(""))).toEqual(values);
    expect(getRowAt(root, [0, 3]).length).toBe(1);
  });

  it("keeps the brackets inside the single matrix node", () => {
    const { root } = insertShell("\\begin{pmatrix}\\square & \\square\\\\\\square & \\square\\end{pmatrix}");
    const node = root[0] as any;
    expect(node.left).toBe("(");
    expect(node.right).toBe(")");
    expect(root.length).toBe(1);
  });
});
