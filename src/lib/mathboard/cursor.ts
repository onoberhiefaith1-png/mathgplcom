// MathBoard cursor + container helpers.
// A "container" is an editable Node[] inside a session — either the session
// root array (nodeId=null) or a specific slot of a structural node.

import { Node, slotsOf } from "./tokens";

export interface Container {
  sessionId: string;
  nodeId: string | null;   // null = session root
  slot: string | null;     // null = session root
}

export interface Selection {
  container: Container;
  start: number;            // inclusive
  end: number;              // exclusive
}

export interface Cursor {
  container: Container;
  index: number;            // insertion index within container array
  activeTokenId: string | null; // currently glowing structural token
  selection?: Selection | null;
}

/** Walk the session's node tree to find the array that the container points at. */
export const resolveContainer = (root: Node[], c: Container): Node[] | null => {
  if (c.nodeId === null) return root;
  const seek = (arr: Node[]): Node[] | null => {
    for (const n of arr) {
      if (n.id === c.nodeId) {
        const slot = (n as any)[c.slot!];
        return Array.isArray(slot) ? slot : null;
      }
      // Recurse
      for (const k of slotsOf(n)) {
        const child = (n as any)[k];
        if (Array.isArray(child)) {
          const found = seek(child);
          if (found) return found;
        }
      }
    }
    return null;
  };
  return seek(root);
};

/** Find a node anywhere in the tree by id. */
export const findNodeById = (root: Node[], nodeId: string): Node | null => {
  for (const n of root) {
    if (n.id === nodeId) return n;
    for (const k of slotsOf(n)) {
      const child = (n as any)[k];
      if (Array.isArray(child)) {
        const found = findNodeById(child, nodeId);
        if (found) return found;
      }
    }
  }
  return null;
};

/** Find the parent container of a node by id (for "exit token" navigation). */
export const findParent = (root: Node[], nodeId: string): { container: Container; index: number } | null => {
  const walk = (arr: Node[], parentNodeId: string | null, parentSlot: string | null, sessionId: string): { container: Container; index: number } | null => {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === nodeId) {
        return { container: { sessionId, nodeId: parentNodeId, slot: parentSlot }, index: i };
      }
      for (const k of slotsOf(arr[i])) {
        const child = (arr[i] as any)[k];
        if (Array.isArray(child)) {
          const found = walk(child, arr[i].id, k as string, sessionId);
          if (found) return found;
        }
      }
    }
    return null;
  };
  return walk(root, null, null, "");
};
