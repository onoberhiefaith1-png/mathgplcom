// Generic atomic visual node for the Lesson Notes editor. One node type
// (`mathVisual`) with a `family` (shape | grid | numberline | chart |
// plot | table | manip | tool | illus) and a `variant`, rendered via a
// dispatch table of small SVG components. New visuals = add one entry to
// the dispatch table + one AssetDef in the registry.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useRef } from "react";
import { LivingDiagram } from "./visuals/living/LivingDiagram";
import { useRegisterAssetSnapshot } from "@/hooks/useAssetSnapshot";

function makeVisualInstanceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `mv_${crypto.randomUUID()}`;
  }
  return `mv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function MathVisualView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const family = (node.attrs.family as string) || "shape";
  const attrs = (node.attrs.attrs as Record<string, unknown>) || {};
  const width = Number(node.attrs.width) || 220;
  const variant = String(attrs.variant ?? "");

  // Keep the latest `attrs` in a ref so `handleChange` can be stable —
  // an unstable onChange cascades through every asset's `patch`/editor
  // memo and re-triggers useRegisterAssetEditor on every render.
  const attrsRef = useRef(attrs);
  attrsRef.current = attrs;
  const generatedInstanceIdRef = useRef("");
  if (!generatedInstanceIdRef.current) generatedInstanceIdRef.current = makeVisualInstanceId();
  const persistedInstanceId = typeof attrs.__instanceId === "string" && attrs.__instanceId
    ? attrs.__instanceId
    : "";
  const assetInstanceId = persistedInstanceId || generatedInstanceIdRef.current;

  useEffect(() => {
    if (persistedInstanceId) return;
    updateAttributes({ attrs: { ...attrsRef.current, __instanceId: assetInstanceId } });
  }, [assetInstanceId, persistedInstanceId, updateAttributes]);

  // While selected, this object can be saved into the teacher's Asset Library
  // from the right-hand Properties Panel.
  useRegisterAssetSnapshot(!!selected, assetInstanceId, () => ({
    node: node.toJSON(),
    suggestedName: variant || family,
    source: "visual" as const,
    suggestedSection: family === "smartChart" ? ("tables" as const) : ("diagrams" as const),
  }));

  const handleChange = useCallback(
    (patch: Record<string, unknown>) => updateAttributes({ attrs: { ...attrsRef.current, ...patch } }),
    [updateAttributes],
  );

  // SmartChart is graph paper: render the wrapper as a block-level span
  // that fills the notebook column, not a fixed-width inline atom.
  const isSmartChart = family === "smartChart";
  const wrapperStyle: React.CSSProperties = isSmartChart
    ? { display: "block", width: "100%", maxWidth: "100%" }
    : { width, maxWidth: "100%" };
  const wrapperClass = isSmartChart
    ? "math-visual block w-full my-3"
    : "math-visual inline-block align-middle";

  return (
    <NodeViewWrapper
      as={"span" as any}
      className={wrapperClass}
      style={wrapperStyle}
    >
      <LivingDiagram
        variant={variant}
        family={family}
        attrs={attrs}
        assetId={assetInstanceId}
        selected={!!selected}
        onChange={handleChange}
        onDeleteDiagram={deleteNode}
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
