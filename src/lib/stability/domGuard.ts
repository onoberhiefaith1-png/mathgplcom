// DOM reconciliation guard.
//
// The lesson-notes editor mixes React with ProseMirror node views. ProseMirror
// owns (and sometimes replaces or re-parents) the DOM inside a node view, so
// when React later unmounts that subtree the node it wants to remove may no
// longer be a child of the parent React remembers. React then throws
// "Failed to execute 'removeChild' on 'Node'" during commit, which unmounts
// the whole tree and blanks the page.
//
// Making removeChild / insertBefore tolerant of already-moved nodes turns that
// fatal commit error into a no-op, exactly matching the intent (the node is
// gone / lives elsewhere already).

let installed = false;

export function installDomGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      if (child.parentNode) {
        try {
          return originalRemoveChild.call(child.parentNode, child) as T;
        } catch {
          return child;
        }
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    ref: Node | null,
  ): T {
    if (ref && ref.parentNode !== this) {
      return originalInsertBefore.call(this, node, null) as T;
    }
    return originalInsertBefore.call(this, node, ref) as T;
  };
}
