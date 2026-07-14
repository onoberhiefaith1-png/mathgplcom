// Universal Tree Engine — model types.
// Handles probability trees, decision trees, hierarchies. One model,
// auto-layout, expandable to any depth × any fan-out.

export type TreeDirection = "TB" | "LR" | "radial";

export interface BranchStyle {
  length?: number;   // reserved (auto-layout drives length)
  angle?: number;    // reserved (radial only)
  thickness: number;
  arrow: boolean;
  label: string;
  prob: string;      // probability shown on the branch
  dash?: "solid" | "dashed";
}

export interface TreeNode {
  id: string;
  label: string;
  prob: string;      // probability shown at the node (optional)
  expr: string;      // mathematical expression / outcome
  color: string;
  size: number;      // radius / half-height in svg units
  revealed: boolean; // classroom drip-reveal
  branch: BranchStyle; // style of the branch leading INTO this node
  children: TreeNode[];
}

export interface TreeModel {
  root: TreeNode;
  direction: TreeDirection;
  defaults: {
    color: string;
    size: number;
    thickness: number;
    arrow: boolean;
  };
}

export const DEFAULT_BRANCH = (): BranchStyle => ({
  thickness: 1.5,
  arrow: false,
  label: "",
  prob: "",
  dash: "solid",
});

export function newNodeId(): string {
  return `t${Math.random().toString(36).slice(2, 9)}`;
}
