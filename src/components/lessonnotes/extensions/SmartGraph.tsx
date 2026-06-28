// TipTap node holding a Smart Graph workspace.
//
// All state — scale, axis labels, data points, connection style — lives
// in the node attrs so undo/redo and persistence flow through TipTap.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SmartGraphView } from "@/components/lessonnotes/math-tools/SmartGraphView";

export type ConnectStyle = "straight" | "smooth" | "broken" | "scatter";

export interface GraphPoint { x: number; y: number; label?: string }

/** A geometry shape drawn on top of the graph (pixel-space relative to the SVG). */
export interface GraphShape {
  id: string;
  kind: "point" | "line" | "circle" | "arc" | "polygon";
  pts: Array<{ x: number; y: number }>;
  label?: string;
}

export interface SmartGraphAttrs {
  unitsPerSquareX: number;
  unitsPerSquareY: number;
  squaresX: number;
  squaresY: number;
  originSquareX: number; // origin offset in squares from left
  originSquareY: number; // origin offset in squares from top
  xLabel: string;
  yLabel: string;
  points: GraphPoint[];
  connect: ConnectStyle;
  shapes: GraphShape[];
}

export const DEFAULT_GRAPH: SmartGraphAttrs = {
  unitsPerSquareX: 1,
  unitsPerSquareY: 1,
  squaresX: 20,
  squaresY: 14,
  originSquareX: 10,
  originSquareY: 7,
  xLabel: "x",
  yLabel: "y",
  points: [],
  connect: "straight",
};

export const SmartGraphNode = Node.create({
  name: "smartGraph",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      unitsPerSquareX: { default: DEFAULT_GRAPH.unitsPerSquareX },
      unitsPerSquareY: { default: DEFAULT_GRAPH.unitsPerSquareY },
      squaresX: { default: DEFAULT_GRAPH.squaresX },
      squaresY: { default: DEFAULT_GRAPH.squaresY },
      originSquareX: { default: DEFAULT_GRAPH.originSquareX },
      originSquareY: { default: DEFAULT_GRAPH.originSquareY },
      xLabel: { default: DEFAULT_GRAPH.xLabel },
      yLabel: { default: DEFAULT_GRAPH.yLabel },
      points: { default: DEFAULT_GRAPH.points },
      connect: { default: DEFAULT_GRAPH.connect },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-smart-graph]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-smart-graph": "" }), ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SmartGraphView);
  },
});
