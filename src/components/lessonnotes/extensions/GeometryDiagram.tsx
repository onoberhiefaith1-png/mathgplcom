// TipTap extension: an editable block node that holds a GeometryScene.
// The NodeView renders the scene as SVG inside a Word-style frame.
//
//   • Idle           — almost-invisible 1px border, no controls.
//   • Hover          — faint blue border, edge toolbar + handles fade in.
//   • Selected       — solid blue outline + resize/move handles + toolbar.
//   • Selected + Geometry Mode — the static SVG is swapped for the live
//     GeometryCanvas so the teacher can draw inside the frame.
//
// All editing happens inside the lesson note; there is no separate panel.

import { useEffect, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import {
  Sparkles, Trash2, Copy, Lock, Unlock, GripVertical, RotateCw,
} from "lucide-react";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { GeometryCanvas } from "@/components/lessonnotes/geometry-editor/GeometryCanvas";
import { useGeometryEditor } from "@/components/lessonnotes/geometry-editor/useGeometryEditor";
import { useGeometryMode } from "@/components/lessonnotes/geometry-editor/GeometryModeContext";
import {
  type GeometryScene,
  sanitizeScene,
  EMPTY_SCENE,
} from "@/lib/geometry/scene";
import { rotateScene } from "@/lib/geometry/editor/sceneOps";
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

  const { mode, setMode, setActiveFrameId, tool } = useGeometryMode();
  const sessionIdRef = useRef<string>(
    `gd-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [hovered, setHovered] = useState(false);

  // Per-frame editor state (drives the in-frame GeometryCanvas).
  const geoEditor = useGeometryEditor(scene, (next) =>
    updateAttributes({ scene: next }),
  );
  // Sync the tool from the global toolbox.
  useEffect(() => {
    if (selected && mode) geoEditor.setTool(tool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, selected, mode]);

  // When this frame becomes the selected node, mark it active and turn
  // Geometry Mode on. Clicking out (selected → false) leaves mode on so
  // the teacher can click back in and resume editing.
  useEffect(() => {
    if (selected) {
      setActiveFrameId(sessionIdRef.current);
      if (!mode) setMode(true);
    }
    // We don't clear activeFrameId on deselect — the toolbox stays
    // ready and another frame's select will overwrite it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Natural diagram size from the scene bounds.
  const naturalW = (scene.bounds?.width ?? 360) + PAD * 2;
  const naturalH = (scene.bounds?.height ?? 240) + PAD * 2;
  const isEditing = selected && mode;
  // While editing, use natural size so canvas coordinates stay accurate.
  // Otherwise honour the locked/explicit size; unlocked = auto-fit.
  const width: number = isEditing
    ? naturalW
    : locked && node.attrs.width ? node.attrs.width : naturalW;
  const height: number = isEditing
    ? naturalH
    : locked && node.attrs.height ? node.attrs.height : naturalH;

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
      void dy; void sy;
      const ratio = startW / startH;
      const dw = Math.max(MIN_W - startW, dx * sx);
      const newW = Math.max(MIN_W, startW + dw);
      const newH = Math.max(MIN_H, newW / ratio);
      updateAttributes({
        width: Math.round(newW),
        height: Math.round(newH),
        locked: true,
      });
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

  // Show chrome (handles + edge toolbar) when hovered OR selected.
  const showChrome = hovered || selected;

  // Outline tier: selected > hovered > idle.
  const outlineCls = selected
    ? "outline outline-2 outline-blue-500"
    : hovered
      ? "outline outline-1 outline-blue-400/70"
      : "outline outline-1 outline-foreground/10";

  return (
    <NodeViewWrapper
      className={cn("my-3 flex", containerAlign)}
      contentEditable={false}
    >
      <div
        className={cn("relative inline-block bg-white rounded transition-[outline]", outlineCls)}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseDown={(e) => {
          // Always select the node on click so TipTap reports selected = true
          // and the canvas (if Geometry Mode is on) takes over drawing.
          const pos = typeof getPos === "function" ? getPos() : null;
          if (pos != null && !selected) {
            editor.commands.setNodeSelection(pos);
          }
          e.stopPropagation();
        }}
      >
        {/* Move grip (drag handle) */}
        {showChrome && (
          <div
            data-drag-handle
            draggable
            className="absolute -left-5 top-2 h-7 w-5 grid place-items-center text-foreground/50 cursor-grab active:cursor-grabbing bg-background border border-foreground/20 rounded"
            title="Drag to move"
          >
            <GripVertical className="h-3 w-3" />
          </div>
        )}

        {/* Drawing surface */}
        <div className="absolute inset-0 grid place-items-center overflow-hidden">
          {isEditing ? (
            <GeometryCanvas editor={geoEditor} />
          ) : (
            <GeometryDiagram
              scene={scene}
              explicitWidth={width}
              explicitHeight={height}
            />
          )}
        </div>

        {scene.meta?.caption && (
          <p
            className="absolute -bottom-5 left-0 right-0 text-[11px] italic text-center text-black/70"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {scene.meta.caption}
          </p>
        )}

        {/* Edge toolbar */}
        {showChrome && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background border border-foreground/15 rounded-md shadow px-1 py-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openGeometryAiEdit({
                  scene,
                  topic,
                  onApply: (next) => updateAttributes({ scene: next }),
                });
              }}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded text-foreground hover:bg-foreground/5"
              title="AI edit"
            >
              <Sparkles className="h-3 w-3" /> AI
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateAttributes({ scene: rotateScene(scene, 15).scene });
              }}
              className="inline-flex items-center justify-center h-6 w-6 rounded text-foreground/70 hover:bg-foreground/5"
              title="Rotate 15°"
            >
              <RotateCw className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDuplicate(); }}
              className="inline-flex items-center justify-center h-6 w-6 rounded text-foreground/70 hover:bg-foreground/5"
              title="Duplicate"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateAttributes({ locked: !locked });
              }}
              className={cn(
                "inline-flex items-center justify-center h-6 w-6 rounded hover:bg-foreground/5",
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

        {/* Resize handles (corners) */}
        {showChrome && (
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
