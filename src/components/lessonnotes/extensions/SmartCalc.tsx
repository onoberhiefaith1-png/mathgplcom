// TipTap node holding the AI-generated working for one calculation.
// Stores the expression, formula, substitution, steps, answer — all
// editable through the NodeView.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SmartCalcView } from "@/components/lessonnotes/math-tools/SmartCalcView";

export interface SmartCalcAttrs {
  expression: string;
  formula: string;
  substitution: string;
  steps: string[];
  answer: string;
}

export const SmartCalcNode = Node.create({
  name: "smartCalc",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      expression: { default: "" },
      formula: { default: "" },
      substitution: { default: "" },
      steps: { default: [] },
      answer: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-smart-calc]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-smart-calc": "" }), ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SmartCalcView);
  },
});
