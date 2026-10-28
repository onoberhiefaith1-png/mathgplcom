// CanvasEmbed — a chosen Canvas presentation sitting IN the lesson note, exactly
// the way a diagram sits in the note. It is a real document node, so it is
// saved with the note, travels to the Smartboard through the normal object
// pipeline, and keeps its own region (width share) and identity.
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { CanvasSlideViewer, clampCanvasScale } from "../slides/CanvasSlideViewer";
import { clampBoundedOffset, clampVisualZoom } from "@/lib/visualTransform";

const CanvasEmbedView = ({ node, selected, updateAttributes }: NodeViewProps) => {
  const canvasId = String(node.attrs?.canvasId ?? "");
  const canvasName = node.attrs?.canvasName ? String(node.attrs.canvasName) : undefined;
  const scale = clampCanvasScale(node.attrs?.scale);
  return (
    <NodeViewWrapper className="lesson-canvas-embed" data-canvas-id={canvasId}>
      {canvasId
        ? <CanvasSlideViewer
            canvasId={canvasId}
            canvasName={canvasName}
            scale={scale}
            authoredZoom={clampVisualZoom(node.attrs?.zoom)}
            authoredOffsetX={Number(node.attrs?.offsetX) || 0}
            authoredOffsetY={Number(node.attrs?.offsetY) || 0}
            active={selected}
            onTransformChange={(next) => updateAttributes(next)}
          />
        : <div className="my-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Choose a Canvas for this session.
          </div>}
    </NodeViewWrapper>
  );
};

export const CanvasEmbed = Node.create({
  name: "canvasEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      canvasId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-canvas-id"),
        renderHTML: (attrs) => (attrs.canvasId ? { "data-canvas-id": attrs.canvasId } : {}),
      },
      canvasName: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-canvas-name"),
        renderHTML: (attrs) => (attrs.canvasName ? { "data-canvas-name": attrs.canvasName } : {}),
      },
      /** Share of the note width this Canvas occupies (0.3 – 1). */
      scale: {
        default: 1,
        parseHTML: (el) => clampCanvasScale(el.getAttribute("data-scale")),
        renderHTML: (attrs) => ({ "data-scale": String(clampCanvasScale(attrs.scale)) }),
      },
      /** Uniform whole-presentation zoom. Individual slide media remains editable only in Canvas/Edit. */
      zoom: {
        default: 1,
        parseHTML: (el) => clampVisualZoom(el.getAttribute("data-zoom")),
        renderHTML: (attrs) => ({ "data-zoom": String(clampVisualZoom(attrs.zoom)) }),
      },
      offsetX: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-offset-x")) || 0,
        renderHTML: (attrs) => attrs.offsetX ? { "data-offset-x": String(attrs.offsetX) } : {},
      },
      offsetY: {
        default: 0,
        parseHTML: (el) => clampBoundedOffset(el.getAttribute("data-offset-y"), 0, 160),
        renderHTML: (attrs) => attrs.offsetY ? { "data-offset-y": String(attrs.offsetY) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-canvas-embed-node]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-canvas-embed-node": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CanvasEmbedView);
  },
});

export default CanvasEmbed;
