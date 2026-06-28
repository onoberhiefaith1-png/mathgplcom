// TipTap extension: an editable block node that holds a GeometryScene.
// The NodeView renders the scene as SVG inside a Word-style frame —
// idle = nearly invisible border; selected = blue outline with resize
// and move handles. Selecting the frame auto-opens the right-edge
// Geometry editor dock; clicking outside closes it.

import { useEffect, useRef } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Sparkles, Trash2, Copy, Lock, Unlock, GripVertical } from "lucide-react";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import {
  openGeometryEditor,
  closeGeometryEditor,
} from "@/components/lessonnotes/geometry-editor/GeometryEditorPanel";
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

const MIN_W = 160;
const MIN_H = 120;
const PAD = 24; // matches GeometryDiagram pad

function GeometryDiagramView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const scene =
    (sanitizeScene(node.attrs.scene) as GeometryScene) ?? EMPTY_SCENE;
  const topic = (node.attrs.topic as string) || scene.meta?.topic;
  const locked: boolean = !!node.attrs.locked;
  const align: "left" | "center" | "right" = node.attrs.align ?? "center";

  // Natural diagram size from the scene bounds.
  const naturalW = (scene.bounds?.width ?? 360) + PAD * 2;
  const naturalH = (scene.bounds?.height ?? 240) + PAD * 2;
  // Auto-fit when unlocked: width follows scene bounds. Locked: keep stored size.
  const width: number = locked && node.attrs.width ? node.attrs.width : naturalW;
  const height: number = locked && node.attrs.height ? node.attrs.height : naturalH;

  // Stable session id per node so the dock keeps state across re-renders.
  const sessionIdRef = useRef<string>(
    `gd-${Math.random().toString(36).slice(2, 10)}`,
  );

  // Open / close the dock based on TipTap selection state.
  useEffect(() => {
    if (selected) {
      openGeometryEditor({
        sessionId: sessionIdRef.current,
        scene,
        topic,
        onApply: (next) => updateAttributes({ scene: next }),
      });
    }
    // We deliberately do not close on deselect here — selecting another
    // diagram swaps the session; clicking text doesn't need to tear down
    // the panel mid-edit. The X button + closeGeometryEditor handle that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, scene]);

  // When this node is removed, close the dock if it was editing us.
  useEffect(() => () => closeGeometryEditor(), []);

  const onResize = (e: React.PointerEvent, dir: "se" | "sw" | "ne" | "nw") => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = width;
    const startH = height;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const sx = dir.includes("e") ? 1 : -1;
      const sy = dir.includes("s") ? 1 : -1;
      // Lock aspect ratio with Shift, otherwise keep ratio anyway so the
      // SVG never distorts (geometry must stay true).
      const ratio = startW / startH;
      const dw = Math.max(MIN_W - startW, dx * sx);
      const newW = Math.max(MIN_W, startW + dw);
      const newH = Math.max(MIN_H, newW / ratio);
      updateAttributes({ width: Math.round(newW), height: Math.round(newH), locked: true });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleDuplicate = () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, {
        type: node.type.name,
        attrs: { ...node.attrs },
      })
      .run();
  };

  const containerAlign =
    align === "left" ? "justify-start"
    : align === "right" ? "justify-end"
    : "justify-center";

  return (
    <NodeViewWrapper className={cn("my-3 flex", containerAlign)} contentEditable={false}>
      <div
        className={cn(
          "relative inline-block bg-white rounded transition",
          selected
            ? "outline outline-2 outline-blue-500"
            : "outline outline-1 outline-foreground/10 hover:outline-foreground/30",
        )}
        style={{ width, height }}
        onMouseDown={(e) => {
          // Select the node so TipTap reports `selected = true`.
          const pos = typeof getPos === "function" ? getPos() : null;
          if (pos != null) {
            editor.commands.setNodeSelection(pos);
          }
          e.stopPropagation();
        }}
      >
        {/* Move grip — drag handle for the whole block. */}
        {selected && (
          <div
            data-drag-handle
            draggable
            className="absolute -left-5 top-1/2 -translate-y-1/2 h-7 w-5 grid place-items-center text-foreground/50 cursor-grab active:cursor-grabbing bg-background border border-foreground/20 rounded"
            title="Drag to move"
          >
            <GripVertical className="h-3 w-3" />
          </div>
        )}

        <div className="absolute inset-0 grid place-items-center overflow-hidden">
          <GeometryDiagram scene={scene} explicitWidth={width} explicitHeight={height} />
        </div>

        {scene.meta?.caption && (
          <p
            className="absolute -bottom-5 left-0 right-0 text-[11px] italic text-center text-black/70"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {scene.meta.caption}
          </p>
        )}

        {/* Floating action toolbar */}
        {selected && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background border border-foreground/15 rounded-md shadow px-1 py-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openGeometryAiEdit({ scene, topic, onApply: (next) => updateAttributes({ scene: next }) }); }}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded text-foreground hover:bg-foreground/5"
              title="AI edit"
            >
              <Sparkles className="h-3 w-3" /> AI
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDuplicate(); }}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded text-foreground hover:bg-foreground/5"
              title="Duplicate"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); updateAttributes({ locked: !locked }); }}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded hover:bg-foreground/5",
                locked ? "text-amber-600" : "text-foreground/70",
              )}
              title={locked ? "Unlock size (auto-fit)" : "Lock current size"}
            >
              {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); deleteNode(); }}
              className="inline-flex items-center justify-center h-6 w-6 rounded text-foreground/70 hover:text-red-500 hover:bg-foreground/5"
              title="Delete diagram"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Resize handles (corners). */}
        {selected && (
          <>
            <Handle pos="nw" onPointerDown={(e) => onResize(e, "nw")} />
            <Handle pos="ne" onPointerDown={(e) => onResize(e, "ne")} />
            <Handle pos="sw" onPointerDown={(e) => onResize(e, "sw")} />
            <Handle pos="se" onPointerDown={(e) => onResize(e, "se")} />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function Handle({
  pos,
  onPointerDown,
}: {
  pos: "nw" | "ne" | "sw" | "se";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cls = cn(
    "absolute h-2.5 w-2.5 rounded-sm bg-white border border-blue-500",
    pos === "nw" && "-top-1.5 -left-1.5 cursor-nw-resize",
    pos === "ne" && "-top-1.5 -right-1.5 cursor-ne-resize",
    pos === "sw" && "-bottom-1.5 -left-1.5 cursor-sw-resize",
    pos === "se" && "-bottom-1.5 -right-1.5 cursor-se-resize",
  );
  return <div className={cls} onPointerDown={onPointerDown} />;
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
      width: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("data-width");
          return v ? Number(v) : null;
        },
        renderHTML: (attrs) =>
          attrs.width ? { "data-width": String(attrs.width) } : {},
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("data-height");
          return v ? Number(v) : null;
        },
        renderHTML: (attrs) =>
          attrs.height ? { "data-height": String(attrs.height) } : {},
      },
      locked: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-locked") === "1",
        renderHTML: (attrs) =>
          attrs.locked ? { "data-locked": "1" } : {},
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
