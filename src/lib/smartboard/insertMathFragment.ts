import { extractWrapTargetLeftOf, getRowAt, insertNodeWrapping, mkPower, insertNode, subRowsOf, type Row, type Cursor, type EditResult } from "./mathTree";

/** Insert a floating chip at the maths caret; enter its first visible slot. */
export function insertMathFragment(root: Row, cursor: Cursor, fragment: Row): EditResult {
  // Older Subcell sets saved a bare caret chip. Interpret it as the same
  // exponent action as typing a power, so those sets remain usable.
  if (fragment.length === 1 && fragment[0].kind === "char" && fragment[0].ch === "^") {
    const target = extractWrapTargetLeftOf(getRowAt(root, cursor.path), cursor.index);
    return insertNodeWrapping(root, cursor, mkPower(), target.start, target.end);
  }
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
