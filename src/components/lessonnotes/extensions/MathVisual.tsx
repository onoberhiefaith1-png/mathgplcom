// Generic atomic visual node for the Lesson Notes editor. One node type
// (`mathVisual`) with a `family` (shape | grid | numberline | chart |
// plot | table | manip | tool | illus) and a `variant`, rendered via a
// dispatch table of small SVG components. New visuals = add one entry to
// the dispatch table + one AssetDef in the registry.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { LivingDiagram } from "./visuals/living/LivingDiagram";

function MathVisualView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const family = (node.attrs.family as string) || "shape";
  const attrs = (node.attrs.attrs as Record<string, unknown>) || {};
  const width = Number(node.attrs.width) || 220;
  const variant = String(attrs.variant ?? "");

  return (
    <NodeViewWrapper
      as={"span" as any}
      className="math-visual inline-block align-middle"
      style={{ width, maxWidth: "100%" }}
    >
      <LivingDiagram
        variant={variant}
        family={family}
        attrs={attrs}
        selected={!!selected}
        onChange={(patch) => updateAttributes({ attrs: { ...attrs, ...patch } })}
        onDeleteDiagram={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}

export const MathVisual = Node.create({
  name: "mathVisual",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      family: {
        default: "shape",
        parseHTML: (el) => el.getAttribute("data-family") ?? "shape",
        renderHTML: (a) => ({ "data-family": a.family }),
      },
      width: {
        default: 220,
        parseHTML: (el) => Number(el.getAttribute("data-width")) || 220,
        renderHTML: (a) => ({ "data-width": String(a.width ?? 220) }),
      },
      attrs: {
        default: {},
        parseHTML: (el) => {
          try { return JSON.parse(el.getAttribute("data-attrs") || "{}"); }
          catch { return {}; }
        },
        renderHTML: (a) => ({ "data-attrs": JSON.stringify(a.attrs ?? {}) }),
      },
    };
  },

  parseHTML() { return [{ tag: "span[data-math-visual]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-visual": "" })];
  },
  addNodeView() { return ReactNodeViewRenderer(MathVisualView); },
});
