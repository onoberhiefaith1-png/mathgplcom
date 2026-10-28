// TipTap node holding a Smart Graph workspace.
//
// All state — scale, axis labels, data points, functions, style — lives in the
// node attrs so undo/redo and persistence flow through TipTap. The data model
// itself lives in src/lib/graph/graphModel.ts so the Smartboard can run the
// same graph engine without importing this TipTap node.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SmartGraphView } from "@/components/lessonnotes/math-tools/SmartGraphView";
import { DEFAULT_GRAPH, DEFAULT_GRAPH_STYLE, sanitizeGraphAttrs } from "@/lib/graph/graphModel";

export type {
  ConnectStyle, GraphPoint, GraphShape, GraphOverlay, GraphFunction, GraphStyle,
  SmartGraphAttrs,
} from "@/lib/graph/graphModel";
export { DEFAULT_GRAPH, DEFAULT_GRAPH_STYLE, sanitizeGraphAttrs };

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
      shapes: { default: DEFAULT_GRAPH.shapes },
      overlays: { default: DEFAULT_GRAPH.overlays },
      functions: { default: DEFAULT_GRAPH.functions },
      style: { default: DEFAULT_GRAPH.style },
      viewZoom: { default: DEFAULT_GRAPH.viewZoom },
      frameW: { default: DEFAULT_GRAPH.frameW },
      frameH: { default: DEFAULT_GRAPH.frameH },
      offsetX: { default: DEFAULT_GRAPH.offsetX },
      offsetY: { default: DEFAULT_GRAPH.offsetY },
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
