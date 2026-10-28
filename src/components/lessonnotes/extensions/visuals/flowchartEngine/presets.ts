import type { FlowModel } from "./types";
import { makeFlowNode } from "./types";

export function buildFlowPreset(_name: string): FlowModel {
  const start = makeFlowNode("start", 200, 40);
  const proc = makeFlowNode("process", 190, 140);
  const end = makeFlowNode("end", 200, 260);
  return {
    nodes: [start, proc, end],
    edges: [
      { id: "e1", from: start.id, to: proc.id, style: "orthogonal", arrow: true, label: "" },
      { id: "e2", from: proc.id,  to: end.id,  style: "orthogonal", arrow: true, label: "" },
    ],
    layout: "vertical",
    canvas: { w: 520, h: 340 },
  };
}
