// Inline atomic TipTap node for a "Math Object" — a small flat SVG that
// teachers drop into a lesson note (cars, apples, coins, dice…). Used as a
// concrete-visual stepping stone before introducing algebraic variables.
//
// attrs:
//   kind  — string id from the catalog (e.g. "car", "apple")
//   size  — pixel size of the rendered square (default 28)

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { OBJECT_BY_KIND } from "@/lib/mathObjects/catalog";

const SIZE_PRESETS = [20, 28, 40, 56, 80];

function MathObjectView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const kind = (node.attrs.kind as string) ?? "";
  const size = Math.max(12, Math.min(160, Number(node.attrs.size) || 28));
  const def = OBJECT_BY_KIND[kind];

  const bump = (delta: number) => {
    const idx = SIZE_PRESETS.findIndex((s) => s >= size);
    const next = SIZE_PRESETS[Math.max(0, Math.min(SIZE_PRESETS.length - 1, (idx === -1 ? SIZE_PRESETS.length - 1 : idx) + delta))];
    updateAttributes({ size: next });
  };

  return (
    <NodeViewWrapper
      as="span"
      className={`inline-flex items-center align-middle mx-0.5 rounded ${selected ? "ring-2 ring-primary/60" : ""}`}
      contentEditable={false}
      data-math-object-kind={kind}
    >
      <span
        title={def?.label ?? kind}
        aria-label={def?.label ?? kind}
        style={{ width: size, height: size, display: "inline-block", color: "currentColor" }}
      >
        {def ? def.draw() : <span className="text-xs opacity-40">[{kind}]</span>}
      </span>
      {selected && (
        <span className="ml-1 inline-flex items-center gap-0.5 rounded border bg-popover text-popover-foreground px-1 py-0.5 text-[10px] leading-none">
          <button type="button" className="px-1 hover:bg-foreground/10 rounded" onClick={() => bump(-1)}>−</button>
          <span className="tabular-nums w-6 text-center">{size}</span>
          <button type="button" className="px-1 hover:bg-foreground/10 rounded" onClick={() => bump(1)}>+</button>
          <button type="button" className="px-1 hover:bg-foreground/10 rounded" onClick={() => deleteNode()}>×</button>
        </span>
      )}
    </NodeViewWrapper>
  );
}

export const MathObjectNode = Node.create({
  name: "mathObject",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      kind: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-kind") ?? "",
        renderHTML: (a) => ({ "data-kind": a.kind ?? "" }),
      },
      size: {
        default: 28,
        parseHTML: (el) => Number(el.getAttribute("data-size")) || 28,
        renderHTML: (a) => ({ "data-size": String(a.size ?? 28) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-math-object]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-object": "" }), ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathObjectView);
  },
});
