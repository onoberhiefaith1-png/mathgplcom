// TipTap block node that holds a generated Mathematical Table clipping.
//
// The node stores the table id + input + the GeneratedTable snapshot,
// plus a parallel `edits` map so teacher overrides survive regenerate.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MathTableView } from "@/components/lessonnotes/math-tools/MathTableView";
import type { GeneratedTable } from "@/lib/tables/catalog";

export interface MathTableAttrs {
  tableId: string;
  tableName: string;
  input: number;
  generated: GeneratedTable | null;
  /** rowIndex:cellKey -> teacher override string */
  edits: Record<string, string>;
}

export const MathTableNode = Node.create({
  name: "mathTable",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      tableId: { default: "" },
      tableName: { default: "" },
      input: { default: 0 },
      generated: { default: null },
      edits: { default: {} },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-math-table]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-math-table": "" }), ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathTableView);
  },
});
