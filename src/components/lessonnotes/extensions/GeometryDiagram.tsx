// TipTap extension: a block node that holds a GeometryScene.
//
// The whole lesson note is the drawing board — this node renders as
// plain inline SVG with no frame, no border, no background. When the
// node is selected, the static SVG is swapped for the live
// GeometryCanvas so the teacher can draw directly in place, and the
// current selection publishes its editor to the right-hand Properties
// Panel via useRegisterAssetEditor.

import { useEffect, useMemo, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Copy, CopyPlus, Sparkles, Trash2 } from "lucide-react";
import {
  type GeometryScene,
  sanitizeScene,
  EMPTY_SCENE,
} from "@/lib/geometry/scene";
import { GeometryDiagram as StaticGeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { GeometryCanvas } from "@/components/lessonnotes/geometry-editor/GeometryCanvas";
import { useGeometryEditor } from "@/components/lessonnotes/geometry-editor/useGeometryEditor";
import { useGeometryMode } from "@/components/lessonnotes/geometry-editor/GeometryModeContext";
import { SelectionInspector } from "@/components/lessonnotes/geometry-editor/SelectionInspector";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { cn } from "@/lib/utils";

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

function GeometryDiagramView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor: tiptapEditor,
  getPos,
}: NodeViewProps) {
  const sceneKey = JSON.stringify(node.attrs.scene ?? EMPTY_SCENE);
  const scene = useMemo(
    () => (sanitizeScene(node.attrs.scene) as GeometryScene) ?? EMPTY_SCENE,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sceneKey],
  );

  const topic = (node.attrs.topic as string) || scene.meta?.topic;
  const align: "left" | "center" | "right" = node.attrs.align ?? "center";
  const containerAlign =
    align === "left" ? "justify-start"
    : align === "right" ? "justify-end"
    : "justify-center";

  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  // Auto-hide action row.
  const [aiVisible, setAiVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const kickAi = () => {
    setAiVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setAiVisible(false), 10_000);
  };
  useEffect(() => {
    if (selected) kickAi();
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <NodeViewWrapper
      data-geometry-diagram-node="true"
      className={cn("my-3 flex", containerAlign)}
      contentEditable={false}
    >
      <div
        data-geometry-diagram-wrapper="true"
        data-geometry-pos={typeof getPos === "function" ? String(getPos()) : undefined}
        className="relative inline-block"
        onMouseEnter={kickAi}
        onMouseMove={kickAi}
        onFocus={kickAi}
        onMouseDown={(e) => {
          kickAi();
          const pos = typeof getPos === "function" ? getPos() : null;
          if (pos != null && !selected) {
            tiptapEditor.commands.setNodeSelection(pos);
          }
        }}
      >
        {selected ? (
          <LiveEditor
            instanceId={instanceId}
            scene={scene}
            onChange={(next) => updateAttributes({ scene: next })}
          />
        ) : (
          <StaticGeometryDiagram scene={scene} />
        )}

        {(selected || aiVisible) && (
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 -bottom-9 flex items-center gap-1 bg-background/95 border border-foreground/15 rounded-md shadow px-1 py-0.5 transition-opacity duration-200",
              aiVisible ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            onMouseEnter={kickAi}
            onMouseMove={kickAi}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                kickAi();
                openGeometryAiEdit({
                  scene,
                  topic,
                  onApply: (next) => updateAttributes({ scene: next }),
                });
              }}
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded text-foreground hover:bg-foreground/5"
              title="AI edit"
            >
              <Sparkles className="h-3 w-3" /> AI
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                kickAi();
                const pos = typeof getPos === "function" ? getPos() : null;
                if (pos == null) return;
                tiptapEditor.chain().focus().insertContentAt(pos + node.nodeSize, {
                  type: "geometryDiagram",
                  attrs: { scene, topic, align },
                }).run();
              }}
              className="inline-flex items-center justify-center h-5 w-5 rounded text-foreground/70 hover:bg-foreground/5"
              title="Duplicate diagram"
            >
              <CopyPlus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                kickAi();
                navigator.clipboard?.writeText(JSON.stringify({ type: "geometryDiagram", attrs: { scene, topic, align } })).catch(() => {});
              }}
              className="inline-flex items-center justify-center h-5 w-5 rounded text-foreground/70 hover:bg-foreground/5"
              title="Copy diagram data"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); deleteNode(); }}
              className="inline-flex items-center justify-center h-5 w-5 rounded text-foreground/70 hover:text-red-500 hover:bg-foreground/5"
              title="Delete diagram"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/** In-place live editor. Syncs its tool with the left-side GeometryToolbox
 *  and publishes the current selection to the right-hand Properties Panel. */
function LiveEditor({
  instanceId,
  scene,
  onChange,
}: {
  instanceId: string;
  scene: GeometryScene;
  onChange: (next: GeometryScene) => void;
}) {
  const editor = useGeometryEditor(scene, onChange);
  const { tool: modeTool } = useGeometryMode();

  // Sync tool from the shared context (left-side toolbox).
  useEffect(() => {
    if (modeTool !== editor.tool) editor.setTool(modeTool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeTool]);

  const selected = editor.selectedObjects[0] ?? null;
  const editorNode = useMemo(() => (
    <SelectionInspector
      scene={editor.scene}
      selected={editor.selectedObjects}
      kind={editor.selectionKind}
      onApply={(next) => editor.commit(next)}
    />
  ), [editor.scene, editor.selectedObjects, editor.selectionKind]);

  const title = selected ? `${selected.type[0].toUpperCase()}${selected.type.slice(1)}` : "Geometry";
  useRegisterAssetEditor(true, `geometry:${instanceId}`, title, editorNode);

  return <GeometryCanvas editor={editor} />;
}

export const GeometryDiagramNode = Node.create({
  name: "geometryDiagram",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

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
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") || "center",
        renderHTML: (attrs) =>
          attrs.align && attrs.align !== "center" ? { "data-align": attrs.align } : {},
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
