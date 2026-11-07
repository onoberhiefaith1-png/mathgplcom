import { insertNode, type Cursor, type Node, type Row } from "./mathTree";

/**
 * Insert a mirrored Floating Number (one or more nodes) at the cursor as ONE
 * unit. Every node is placed side by side first; only then does the cursor
 * move into the first empty container. Descending earlier put the following
 * siblings (e.g. a closing bracket) INSIDE that container.
 */
export const insertMirroredRow = (root: Row, cursor: Cursor, nodes: readonly Node[]): { root: Row; cursor: Cursor } => {
  let r = root;
  let cur = cursor;
  let enter: Cursor | null = null;
  for (const node of nodes) {
    const res = insertNode(r, cur, node, false);
    r = res.root;
    if (!enter && node.kind !== "char") {
      const subRows = (node as Extract<Node, { rows: Row[] }>).rows ?? [];
      const emptyAt = subRows.findIndex((sub) => sub.length === 0);
      if (emptyAt >= 0 && subRows.every((sub) => sub.length === 0)) {
        enter = { path: [...res.cursor.path, res.cursor.index - 1, emptyAt], index: 0 };
      }
    }
    cur = res.cursor;
  }
  return { root: r, cursor: enter ?? cur };
};
