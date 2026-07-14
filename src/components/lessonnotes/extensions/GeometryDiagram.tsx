// TipTap extension: a block node that holds a GeometryScene.
//
// The frame is gone. The node renders as a plain inline SVG inside the
// lesson note — no border, no resize handles, no hover toolbar. When
// Geometry Mode is on and the node is selected, the static SVG is
// swapped for the live GeometryCanvas so the teacher can draw directly
// in place. A tiny floating action row (AI · Delete) appears only while
// the node is selected — that's the only chrome.

import { useEffect, useMemo, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Copy, CopyPlus, Sparkles, Trash2 } from "lucide-react";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { GeometryCanvas } from "@/components/lessonnotes/geometry-editor/GeometryCanvas";
import { useGeometryEditor } from "@/components/lessonnotes/geometry-editor/useGeometryEditor";
import { useGeometryMode } from "@/components/lessonnotes/geometry-editor/GeometryModeContext";
import { SmartGeometryProvider } from "@/components/lessonnotes/geometry-editor/SmartGeometryContext";
import { SmartOverlay } from "@/components/lessonnotes/geometry-editor/SmartOverlay";
import { RelationshipPanel } from "@/components/lessonnotes/geometry-editor/RelationshipPanel";
import {
  type GeometryScene,
  sanitizeScene,
  EMPTY_SCENE,
} from "@/lib/geometry/scene";
import { cn } from "@/lib/utils";

const PAD = 24;

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
  editor,
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

  const { mode, setMode, tool } = useGeometryMode();

  // Per-node editor state (drives the in-place GeometryCanvas).
  const geoEditor = useGeometryEditor(scene, (next) =>
    updateAttributes({ scene: next }),
  );

  // Sync the tool from the global toolbox while drawing in this node.
  useEffect(() => {
    if (selected && mode) geoEditor.setTool(tool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, selected, mode]);

  const containerAlign =
    align === "left" ? "justify-start"
    : align === "right" ? "justify-end"
    : "justify-center";

  const isEditing = selected && mode;

  const W = scene.bounds.width + PAD * 2;
  const H = scene.bounds.height + PAD * 2;

  // Auto-hide AI action row: show on hover/select, hide 10s after last activity.
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
      <SmartGeometryProvider scene={scene} onSceneChange={(next) => updateAttributes({ scene: next })}>
        <div
          data-geometry-diagram-wrapper="true"
          data-geometry-pos={typeof getPos === "function" ? String(getPos()) : undefined}
          className={cn("relative inline-flex items-start gap-2")}
          onMouseEnter={kickAi}
          onMouseMove={kickAi}
          onFocus={kickAi}
          onMouseDown={(e) => {
            kickAi();
            const pos = typeof getPos === "function" ? getPos() : null;
            if (pos != null && !selected) {
              editor.commands.setNodeSelection(pos);
            }
            if (!isEditing && (!mode || tool === "select")) e.stopPropagation();
          }}
        >
          <div className="relative inline-block">
            {isEditing ? (
              <GeometryCanvas editor={geoEditor} />
            ) : (
              <>
                <GeometryDiagram scene={scene} />
                {selected && <SmartOverlay width={W} height={H} />}
              </>
            )}

            {scene.meta?.caption && (
              <p
                className="mt-1 text-[11px] italic text-center text-black/70"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {scene.meta.caption}
              </p>
            )}

            {/* AI action row — sits BELOW the diagram, away from the top
                manual Edit chip. Auto-hides 10s after last activity. */}
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
                    editor.chain().focus().insertContentAt(pos + node.nodeSize, {
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

          {/* Relationship panel — appears only when at least one diagram
              part is selected. Hidden internally by RelationshipPanel
              when the selection is empty. */}
          <RelationshipPanel
            scene={scene}
            topic={topic}
            onApply={(next) => updateAttributes({ scene: next })}
          />
        </div>
      </SmartGeometryProvider>
    </NodeViewWrapper>
  );
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
