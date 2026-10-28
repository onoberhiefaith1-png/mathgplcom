// NodeAttrsAdapter — lets the Smartboard reuse the Lesson Note tools that were
// written as TipTap node views (Smart Graph, Mathematical Table) without
// changing a line of their logic.
//
// Those views only ever touch `node.attrs`, `updateAttributes`, `deleteNode`
// and `selected`, so we hand them a minimal stand-in backed by board state.
// TipTap's NodeViewWrapper works outside an editor because its context has
// safe defaults.

import type { ReactElement } from "react";
import type { NodeViewProps } from "@tiptap/react";

export function nodeViewPropsFor<T extends Record<string, unknown>>(opts: {
  attrs: T;
  onChange: (patch: Partial<T>) => void;
  onDelete: () => void;
  selected?: boolean;
}): NodeViewProps {
  return {
    node: { attrs: opts.attrs, type: { name: "boardObject" } },
    updateAttributes: (patch: Record<string, unknown>) => opts.onChange(patch as Partial<T>),
    deleteNode: opts.onDelete,
    selected: !!opts.selected,
    editor: null,
    getPos: () => 0,
    decorations: [],
    extension: null,
    HTMLAttributes: {},
    view: null,
    innerDecorations: null,
  } as unknown as NodeViewProps;
}

/** Convenience wrapper so callers read naturally. */
export function AsNodeView<T extends Record<string, unknown>>({
  attrs, onChange, onDelete, selected, render,
}: {
  attrs: T;
  onChange: (patch: Partial<T>) => void;
  onDelete: () => void;
  selected?: boolean;
  render: (props: NodeViewProps) => ReactElement;
}) {
  return render(nodeViewPropsFor({ attrs, onChange, onDelete, selected }));
}
