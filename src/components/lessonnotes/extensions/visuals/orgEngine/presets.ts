import type { OrgModel, OrgNode } from "./types";
import { DEFAULT_EDGE, newOrgId } from "./types";

function n(text: string, shape: OrgNode["shape"] = "roundedRect", children: OrgNode[] = []): OrgNode {
  return {
    id: newOrgId(),
    text,
    color: "#ffffff",
    border: "#3b82f6",
    shape,
    collapsed: false,
    edge: DEFAULT_EDGE(),
    children,
  };
}

export function buildOrgPreset(name: string): OrgModel {
  switch (name) {
    case "hierarchy":
      return {
        direction: "TB",
        root: n("Root", "rect", [
          n("Child A", "rect", [n("A1", "rect"), n("A2", "rect")]),
          n("Child B", "rect", [n("B1", "rect"), n("B2", "rect")]),
        ]),
      };
    case "concept":
      return {
        direction: "radial",
        root: n("Concept", "circle", [
          n("Idea 1", "roundedRect"),
          n("Idea 2", "roundedRect"),
          n("Idea 3", "roundedRect"),
          n("Idea 4", "roundedRect"),
        ]),
      };
    case "mindmap":
    default:
      return {
        direction: "LR",
        root: n("Central idea", "circle", [
          n("Branch 1", "roundedRect", [n("Detail", "roundedRect")]),
          n("Branch 2", "roundedRect"),
          n("Branch 3", "roundedRect"),
        ]),
      };
  }
}
