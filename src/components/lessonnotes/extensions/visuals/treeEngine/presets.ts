import type { TreeModel, TreeNode } from "./types";
import { DEFAULT_BRANCH, newNodeId } from "./types";

function makeNode(label: string, children: TreeNode[] = []): TreeNode {
  return {
    id: newNodeId(),
    label,
    prob: "",
    expr: "",
    color: "#111827",
    size: 18,
    revealed: true,
    branch: DEFAULT_BRANCH(),
    children,
  };
}

function build(levels: number, fan: number, path = ""): TreeNode {
  if (levels <= 0) return makeNode(path || "•");
  const kids: TreeNode[] = [];
  for (let i = 0; i < fan; i++) {
    kids.push(build(levels - 1, fan, `${path}${i + 1}`));
  }
  return makeNode(path || "Root", kids);
}

export function buildTreePreset(name: string): TreeModel {
  switch (name) {
    case "tree3":
      return { root: build(2, 3), direction: "TB", defaults: { color: "#111827", size: 18, thickness: 1.5, arrow: false } };
    case "treeBlank":
      return { root: makeNode("Root"), direction: "TB", defaults: { color: "#111827", size: 18, thickness: 1.5, arrow: false } };
    case "tree2":
    default:
      return { root: build(2, 2), direction: "TB", defaults: { color: "#111827", size: 18, thickness: 1.5, arrow: false } };
  }
}
