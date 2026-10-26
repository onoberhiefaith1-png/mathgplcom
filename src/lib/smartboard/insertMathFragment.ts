import { insertNode, subRowsOf, type Row, type Cursor, type EditResult } from "./mathTree";

/** Insert a floating chip at the maths caret; enter its first visible slot. */
export function insertMathFragment(root: Row, cursor: Cursor, fragment: Row): EditResult {
  let next = { root, cursor };
  for (const node of fragment) next = insertNode(next.root, next.cursor, node, false);
  const slot = (row: Row, path: number[]): Cursor | null => {
    if (row.length === 0) return { path, index: 0 };
    for (let i = 0; i < row.length; i++) {
      const node = row[i];
      if (node.kind === "char" && node.ch === "□") return { path, index: i };
      for (const [j, child] of subRowsOf(node).entries()) {
        if (node.kind === "subsup" && j === 1 && child.length === 0) continue;
        const found = slot(child, [...path, i, j]);
        if (found) return found;
      }
    }
    return null;
  };
  // Only slots belonging to the inserted chip may take ownership.
  const start = next.cursor.index - fragment.length;
  for (let i = 0; i < fragment.length; i++) {
    for (const [j, child] of subRowsOf(fragment[i]).entries()) {
      if (fragment[i].kind === "subsup" && j === 1 && child.length === 0) continue;
      const found = slot(child, [...cursor.path, start + i, j]);
      if (found) return { root: next.root, cursor: found };
    }
  }
  return next;
}
