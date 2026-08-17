// TipTap extension: a block node that holds a GeometryScene.
//
// The whole lesson note is the drawing board — this node renders as
// plain inline SVG with no frame, no border, no background. When the
// node is selected, the static SVG is swapped for the live
// GeometryCanvas so the teacher can draw directly in place, and the
// current selection publishes its editor to the right-hand Properties
// Panel via useRegisterAssetEditor.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { closeHistory, undoDepth, redoDepth } from "@tiptap/pm/history";
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
import type { HitKind } from "@/lib/geometry/editor/snap";

import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { useRegisterAssetSnapshot } from "@/hooks/useAssetSnapshot";
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
  useRegisterAssetSnapshot(!!selected, `geometry:${instanceId}`, () => ({
    node: node.toJSON(),
    suggestedName: topic || "Geometry diagram",
    source: "2d" as const,
    suggestedSection: "diagrams" as const,
  }));

  useEffect(() => {
    if (selected) kickAi();
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // First-click reliability: the very first click on an inactive diagram only
  // activates the block (the live canvas does not exist yet), so the item the
  // teacher aimed at would be lost. Remember the click point and replay it on
  // the live canvas as soon as it mounts.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pendingClick = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!selected) return;
    const pt = pendingClick.current;
    pendingClick.current = null;
    if (!pt) return;
    let raf = 0;
    let tries = 0;
    const attempt = () => {
      const svg = wrapRef.current?.querySelector<SVGSVGElement>(
        '[data-geometry-live-canvas="true"] > svg',
      );
      if (!svg) {
        // The live canvas can take a couple of frames to mount; keep trying
        // instead of losing the click (which made the teacher press again).
        if (tries++ < 20) raf = window.requestAnimationFrame(attempt);
        return;
      }
      const opts = {
        clientX: pt.x, clientY: pt.y, bubbles: true, cancelable: true,
        pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1,
      };
      svg.dispatchEvent(new PointerEvent("pointerdown", opts));
      svg.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0 }));
    };
    raf = window.requestAnimationFrame(attempt);
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // ── UNIFIED HISTORY ────────────────────────────────────────────────────
  // The lesson note document owns ONE chronological history. Every diagram
  // edit is written as a normal document transaction that closes the current
  // history group, so each committed change (add line, move point, set an
  // angle) is exactly one entry in the SAME stack as text, images and
  // insertions — and the note's Undo button reverses whichever happened last.
  const commitScene = (next: GeometryScene, opts?: { addToHistory?: boolean }) => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) { updateAttributes({ scene: next }); return; }
    const { state, dispatch } = tiptapEditor.view;
    const target = state.doc.nodeAt(pos);
    if (!target || target.type.name !== "geometryDiagram") {
      updateAttributes({ scene: next });
      return;
    }
    const tr = state.tr.setNodeMarkup(pos, undefined, { ...target.attrs, scene: next });
    if (opts?.addToHistory === false) {
      // Housekeeping only (the one-off scene normalisation on mount) — it must
      // never occupy an undo step of its own.
      tr.setMeta("addToHistory", false);
    } else {
      closeHistory(tr);
    }
    dispatch(tr);
  };

  // Undo/Redo exposed to the diagram UI: they drive the DOCUMENT history, so
  // there is never a second competing stack inside the canvas.
  const [historyTick, setHistoryTick] = useState(0);
  useEffect(() => {
    const bump = () => setHistoryTick((t) => t + 1);
    tiptapEditor.on("transaction", bump);
    return () => { tiptapEditor.off("transaction", bump); };
  }, [tiptapEditor]);
  const docHistory = useMemo(() => ({
    undo: () => tiptapEditor.chain().focus().undo().run(),
    redo: () => tiptapEditor.chain().focus().redo().run(),
    canUndo: undoDepth(tiptapEditor.state) > 0,
    canRedo: redoDepth(tiptapEditor.state) > 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tiptapEditor, historyTick]);



  return (
    <NodeViewWrapper
      data-geometry-diagram-node="true"
      className={cn("my-5 flex w-full clear-both relative", containerAlign)}
      contentEditable={false}
    >
      <div
        ref={wrapRef}
        data-geometry-diagram-wrapper="true"
        data-geometry-pos={typeof getPos === "function" ? String(getPos()) : undefined}
        className="relative inline-block"
        style={{ overflow: "visible" }}

        onMouseEnter={kickAi}
        onMouseMove={kickAi}
        onFocus={kickAi}
        onMouseDown={(e) => {
          kickAi();
          const pos = typeof getPos === "function" ? getPos() : null;
          if (pos != null && !selected) {
            pendingClick.current = { x: e.clientX, y: e.clientY };
            tiptapEditor.commands.setNodeSelection(pos);
          }
        }}
      >

        {selected ? (
          <LiveEditor
            instanceId={instanceId}
            scene={scene}
            onChange={commitScene}
            docHistory={docHistory}
            onDeleteDiagram={() => deleteNode()}
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
                  onApply: (next) => commitScene(next),
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
  docHistory,
  onDeleteDiagram,
}: {
  instanceId: string;
  scene: GeometryScene;
  onChange: (next: GeometryScene, opts?: { addToHistory?: boolean }) => void;
  /** When hosted inside a lesson note, Undo/Redo drive the DOCUMENT history
   *  so text, diagrams, edits and deletions share one chronological stack. */
  docHistory?: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
  onDeleteDiagram?: () => void;
}) {
  // The hook writes a normalised scene back on mount; that housekeeping write
  // must not become an undo step. Any real edit happens after the first frame.
  const normalising = useRef(true);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => { normalising.current = false; });
    return () => window.cancelAnimationFrame(id);
  }, []);
  const handleChange = useCallback((next: GeometryScene) => {
    onChange(next, normalising.current ? { addToHistory: false } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange]);
  const editor = useGeometryEditor(scene, handleChange);
  const { tool: modeTool } = useGeometryMode();

  // Sync tool from the shared context (left-side toolbox).
  useEffect(() => {
    if (modeTool !== editor.tool) editor.setTool(modeTool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeTool]);

  // The active history: the document's when hosted in a lesson note, else the
  // panel's own private stack (other hosts keep their current behaviour).
  const doUndo = docHistory ? docHistory.undo : editor.doUndo;
  const doRedo = docHistory ? docHistory.redo : editor.doRedo;
  const canUndo = docHistory ? docHistory.canUndo : editor.canUndo;
  const canRedo = docHistory ? docHistory.canRedo : editor.canRedo;

  // Keyboard shortcuts: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z or Ctrl+Y (redo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // When the keypress happens inside the note itself and we are already on
      // the document history, the editor's own shortcut handles it — running
      // ours too would undo twice.
      if (docHistory && (e.target as HTMLElement | null)?.closest?.(".ProseMirror")) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        if (canUndo) { e.preventDefault(); doUndo(); }
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        if (canRedo) { e.preventDefault(); doRedo(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, canRedo, doUndo, doRedo, docHistory]);

  const selected = editor.selectedObjects[0] ?? null;
  const selectItem = useMemo(
    () => (id: string, kind: HitKind) => {
      editor.setSelectedIds([id]);
      editor.setSelectionKind(kind);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor.setSelectedIds, editor.setSelectionKind],
  );

  const editorNode = useMemo(() => (
    <SelectionInspector
      scene={editor.scene}
      selected={editor.selectedObjects}
      selectedIds={editor.selectedIds}
      kind={editor.selectionKind}
      onApply={(next) => editor.commit(next)}
      onSelect={selectItem}
      onUndo={doUndo}
      onRedo={doRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      onDeleteDiagram={onDeleteDiagram}
    />
  ), [editor.scene, editor.selectedObjects, editor.selectedIds, editor.selectionKind, editor.commit, selectItem, canUndo, canRedo, doUndo, doRedo, onDeleteDiagram]);

  const kindTitle = (() => {
    const k = editor.selectionKind;
    if (editor.selectedIds.length > 1) return `${editor.selectedIds.length} items`;
    if (!selected) return "Geometry";
    if (k === "segmentBody") return "Line";
    if (k === "segmentLabel" || k === "pointLabel" || k === "label") return "Text";
    if (k === "segmentDistance") return "Distance";
    if (k === "segmentText") return "Text on line";
    if (k === "angleValue") return "Angle value";
    if (k === "point") return "Point";
    if (selected.type === "region") return "Area";
    return `${selected.type[0].toUpperCase()}${selected.type.slice(1)}`;
  })();


  // The token makes every *new* picked item count as a new selection, so the
  // right-hand panel re-opens itself even if the teacher folded it earlier.
  const selectionToken = `${editor.selectedIds.join(",")}|${editor.selectionKind ?? ""}`;
  useRegisterAssetEditor(true, `geometry:${instanceId}`, kindTitle, editorNode, selectionToken);


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
