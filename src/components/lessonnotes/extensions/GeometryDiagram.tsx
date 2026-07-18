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
import { GeometryEditorV2 } from "@/components/lessonnotes/geometry-editor/v2/GeometryEditorV2";
import { StaticV2Render } from "@/components/lessonnotes/geometry-editor/v2/StaticV2Render";
import { sanitizeV2Scene, type V2Scene } from "@/lib/geometry/v2/scene";
import { migrateLegacyToV2 } from "@/lib/geometry/v2/migrate";
import {
  type GeometryScene,
  sanitizeScene,
  EMPTY_SCENE,
} from "@/lib/geometry/scene";
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
  editor,
  getPos,
}: NodeViewProps) {
  const sceneKey = JSON.stringify(node.attrs.scene ?? EMPTY_SCENE);
  const legacyScene = useMemo(
    () => (sanitizeScene(node.attrs.scene) as GeometryScene) ?? EMPTY_SCENE,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sceneKey],
  );

  // Prefer v2 scene when available; otherwise migrate the legacy scene into
  // v2 the first time this node is rendered. Migration is committed to the
  // node's attrs so persistence flips over cleanly.
  const v2FromAttrs = useMemo(
    () => sanitizeV2Scene(node.attrs.sceneV2),
    [node.attrs.sceneV2],
  );
  const migrated = useMemo(
    () => migrateLegacyToV2(legacyScene),
    [legacyScene],
  );
  const scene: V2Scene = v2FromAttrs ?? migrated;

  useEffect(() => {
    if (!v2FromAttrs) {
      updateAttributes({ sceneV2: scene });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topic = (node.attrs.topic as string) || legacyScene.meta?.topic;
  const align: "left" | "center" | "right" = node.attrs.align ?? "center";
  const containerAlign =
    align === "left" ? "justify-start"
    : align === "right" ? "justify-end"
    : "justify-center";

  // Stable instance id so the right-hand PropertiesPanel can distinguish
  // multiple diagrams on the same note.
  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  const handleChange = (next: V2Scene) => updateAttributes({ sceneV2: next });

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
        }}
      >
        <div className="relative inline-block">
          {selected ? (
            <GeometryEditorV2
              instanceId={instanceId}
              scene={scene}
              onChange={handleChange}
              active={selected}
            />
          ) : (
            <StaticV2Render scene={scene} />
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
                    scene: legacyScene,
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
                    attrs: { sceneV2: scene, topic, align },
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
                  navigator.clipboard?.writeText(JSON.stringify({ type: "geometryDiagram", attrs: { sceneV2: scene, topic, align } })).catch(() => {});
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
      </div>
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
      sceneV2: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-scene-v2");
          if (!raw) return null;
          try { return sanitizeV2Scene(JSON.parse(raw)); }
          catch { return null; }
        },
        renderHTML: (attrs) =>
          attrs.sceneV2 ? { "data-scene-v2": JSON.stringify(attrs.sceneV2) } : {},
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
