// TipTap extension: an editable block node that holds a GeometryScene.
// The NodeView renders the scene as SVG and exposes an "AI Edit" button
// that the document editor wires up to GeometryAiPanel.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Sparkles, Trash2, Pencil } from "lucide-react";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { openGeometryEditor } from "@/components/lessonnotes/geometry-editor/GeometryEditorPanel";
import {
  type GeometryScene,
  sanitizeScene,
  EMPTY_SCENE,
} from "@/lib/geometry/scene";

const OPEN_EVENT = "geometry-ai-edit:open";

export function openGeometryAiEdit(detail: {
  scene: GeometryScene;
  topic?: string;
  onApply: (next: GeometryScene) => void;
}) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
}

export function onGeometryAiEdit(
  handler: (detail: {
    scene: GeometryScene;
    topic?: string;
    onApply: (next: GeometryScene) => void;
  }) => void,
) {
  const wrapped = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(OPEN_EVENT, wrapped);
  return () => window.removeEventListener(OPEN_EVENT, wrapped);
}

function GeometryDiagramView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const scene =
    (sanitizeScene(node.attrs.scene) as GeometryScene) ?? EMPTY_SCENE;
  const topic = (node.attrs.topic as string) || scene.meta?.topic;

  const handleAiEdit = () => {
    openGeometryAiEdit({
      scene,
      topic,
      onApply: (next) => updateAttributes({ scene: next }),
    });
  };

  return (
    <NodeViewWrapper
      className="my-3 group relative inline-block align-middle"
      contentEditable={false}
    >
      <div className="rounded-md border border-foreground/15 bg-white p-2 shadow-sm">
        <GeometryDiagram scene={scene} />
        {scene.meta?.caption && (
          <p
            className="text-[11px] italic text-center mt-1 text-black/70"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {scene.meta.caption}
          </p>
        )}
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            type="button"
            onClick={handleAiEdit}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground shadow"
            title="AI edit this diagram"
          >
            <Sparkles className="h-3 w-3" /> AI Edit
          </button>
          <button
            type="button"
            onClick={() => deleteNode()}
            className="inline-flex items-center justify-center h-6 w-6 rounded bg-white border border-foreground/20 text-foreground/70 hover:text-red-500 shadow"
            title="Delete diagram"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const GeometryDiagramNode = Node.create({
  name: "geometryDiagram",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      scene: {
        default: EMPTY_SCENE,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-scene");
          if (!raw) return EMPTY_SCENE;
          try { return sanitizeScene(JSON.parse(raw)) ?? EMPTY_SCENE; }
          catch { return EMPTY_SCENE; }
        },
        renderHTML: (attrs) => ({
          "data-scene": JSON.stringify(attrs.scene ?? EMPTY_SCENE),
        }),
      },
      topic: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-topic") || null,
        renderHTML: (attrs) =>
          attrs.topic ? { "data-topic": attrs.topic } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-geometry-diagram]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-geometry-diagram": "" }),
      "",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GeometryDiagramView);
  },
});
