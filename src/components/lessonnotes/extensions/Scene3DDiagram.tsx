// TipTap extension: a block node holding a Scene3D exported from the 3D
// Geometry Workspace. It stays a LIVE interactive 3D object — never an image.
//
// The canvas mounts lazily (click to activate) because browsers cap active
// WebGL contexts (~8-16); several 3D diagrams on one page would otherwise
// crash the renderer.

import { Suspense, lazy, useMemo, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Boxes, Pencil, Trash2 } from "lucide-react";
// three.js only loads when a teacher actually activates a 3D diagram, so the
// lesson note itself opens without it.
const Scene3DCanvas = lazy(() =>
  import("@/components/lessonnotes/geometry3d/Scene3DCanvas").then((m) => ({ default: m.Scene3DCanvas })),
);
import { EMPTY_SCENE_3D, sanitizeScene3D, type Scene3D } from "@/lib/geometry3d/scene3d";
import { useRegisterAssetSnapshot } from "@/hooks/useAssetSnapshot";
import { cn } from "@/lib/utils";

const EDIT_EVENT = "geometry3d-workspace:open";

/** Ask the DocumentEditor to reopen the workspace with this scene. */
export function openScene3DWorkspace(detail: {
  scene: Scene3D;
  onApply: (next: Scene3D) => void;
}) {
  window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail }));
}

export function onScene3DWorkspaceOpen(
  handler: (detail: { scene: Scene3D; onApply: (next: Scene3D) => void }) => void,
) {
  const wrapped = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(EDIT_EVENT, wrapped);
  return () => window.removeEventListener(EDIT_EVENT, wrapped);
}

function Scene3DDiagramView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const sceneKey = JSON.stringify(node.attrs.scene ?? EMPTY_SCENE_3D);
  const scene = useMemo(
    () => sanitizeScene3D(node.attrs.scene),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sceneKey],
  );
  const [active, setActive] = useState(false);
  const height = Number(node.attrs.height) || 360;
  useRegisterAssetSnapshot(!!selected, "scene3d", () => ({
    node: node.toJSON(),
    suggestedName: "3D diagram",
    source: "3d" as const,
    suggestedSection: "diagrams" as const,
  }));
  const isEditable = editor?.isEditable ?? false;

  return (
    <NodeViewWrapper className="my-3 flex justify-center" contentEditable={false}>
      <div
        data-scene3d-wrapper="true"
        className={cn(
          "relative w-full max-w-3xl overflow-hidden rounded-lg border",
          selected ? "border-primary" : "border-foreground/15",
        )}
        style={{ height }}
      >
        {active ? (
          <Suspense
            fallback={
              <div className="grid h-full w-full place-items-center bg-[#0d0b1e] text-xs text-white/60">
                Preparing 3D…
              </div>
            }
          >
            <Scene3DCanvas scene={scene} frameloop="always" className="h-full w-full" />
          </Suspense>
        ) : (

          <button
            type="button"
            onClick={() => setActive(true)}
            className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0d0b1e] text-white/70 transition hover:text-white"
            aria-label="Activate 3D scene"
          >
            <Boxes className="h-8 w-8" />
            <span className="text-xs font-medium">
              {scene.objects.length} object{scene.objects.length === 1 ? "" : "s"} · click to explore in 3D
            </span>
          </button>
        )}

        {active && (
          <p className="pointer-events-none absolute bottom-2 left-2 text-[10px] text-white/50">
            Drag to rotate · scroll to zoom · right-drag to pan
          </p>
        )}

        {isEditable && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-foreground/15 bg-background/90 px-1 py-0.5 shadow">
            <button
              type="button"
              title="Edit in 3D Workspace"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-foreground/10"
              onClick={(e) => {
                e.stopPropagation();
                openScene3DWorkspace({ scene, onApply: (next) => updateAttributes({ scene: next }) });
              }}
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              type="button"
              title="Delete 3D scene"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-foreground/70 hover:bg-foreground/10 hover:text-red-500"
              onClick={(e) => { e.stopPropagation(); deleteNode(); }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const Scene3DDiagramNode = Node.create({
  name: "scene3dDiagram",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      // Persistent identity so the same 3D diagram travels with its note
      // group instead of being recreated on every render/save.
      diagramId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-diagram-id") || null,
        renderHTML: (attrs: Record<string, any>) =>
          attrs.diagramId ? { "data-diagram-id": attrs.diagramId } : {},
      },
      scene: {
        default: EMPTY_SCENE_3D,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-scene3d");
          if (!raw) return EMPTY_SCENE_3D;
          try { return sanitizeScene3D(JSON.parse(raw)); } catch { return EMPTY_SCENE_3D; }
        },
        renderHTML: (attrs) => ({ "data-scene3d": JSON.stringify(attrs.scene ?? EMPTY_SCENE_3D) }),
      },
      height: {
        default: 360,
        parseHTML: (el) => Number(el.getAttribute("data-height")) || 360,
        renderHTML: (attrs) => ({ "data-height": String(attrs.height ?? 360) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-scene3d-diagram]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-scene3d-diagram": "" }), ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(Scene3DDiagramView);
  },
});
