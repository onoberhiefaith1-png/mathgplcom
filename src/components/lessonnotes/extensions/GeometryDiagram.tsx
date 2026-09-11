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
import { Copy, Shapes, Sparkles, Trash2 } from "lucide-react";
import {
  type GeometryScene,
  sanitizeScene,
  EMPTY_SCENE,
} from "@/lib/geometry/scene";
import { GeometryDiagram as StaticGeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { DiagramZoomControl } from "@/components/lessonnotes/geometry-editor/DiagramZoomControl";
import { useDiagramZoom } from "@/lib/geometry/useDiagramZoom";
import { GeometryCanvas } from "@/components/lessonnotes/geometry-editor/GeometryCanvas";
import { useGeometryEditor } from "@/components/lessonnotes/geometry-editor/useGeometryEditor";
import { useGeometryMode } from "@/components/lessonnotes/geometry-editor/GeometryModeContext";
import { SelectionInspector } from "@/components/lessonnotes/geometry-editor/SelectionInspector";
import { GeometryPropertiesWorkspace } from "@/components/lessonnotes/geometry-editor/GeometryPropertiesWorkspace";
import { GeometryGuideView } from "@/components/lessonnotes/geometry-editor/GeometryGuideView";
import { SmartboardPropertyTest } from "@/components/lessonnotes/geometry-editor/SmartboardPropertyTest";
import { sceneHasReviewableProperties } from "@/lib/smartboard/reviewProperties";
import type { HitKind } from "@/lib/geometry/editor/snap";

import { ensureOwnerQuestionId } from "@/lib/lessonnotes/containerRange";

import {
  questionContextForOwner,
  questionHeadingPos,
  type DiagramQuestionContext,
} from "@/lib/geometry/map/solutionText";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { useRegisterAssetSnapshot } from "@/hooks/useAssetSnapshot";
import { cn } from "@/lib/utils";
import { splitPageGeometryScene } from "@/lib/geometry/presentation";

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

  // DIAGRAM ZOOM — this figure only. One factor for width and height, so the
  // geometry and every label/marker keep their exact proportions.
  const { zoom: diagramZoom, setZoom: setDiagramZoom } =
    useDiagramZoom((node.attrs.diagramId as string | null) ?? null);

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

  // PERMANENT IDENTITY. Every diagram gets a persistent id the first time it
  // is mounted, so the same object is referenced by the Solution, the
  // Highlighting workflow and the Smartboard instead of being recreated.
  useEffect(() => {
    if (node.attrs.diagramId) return;
    updateAttributes({
      diagramId: `dgm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.attrs.diagramId]);

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

  // Backfill a stable identity for diagrams created before `diagramId`
  // existed, so a Solution can reference this exact figure. Housekeeping only —
  // never an undo step.
  useEffect(() => {
    if (node.attrs?.diagramId) return;
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return;
    const { state, dispatch } = tiptapEditor.view;
    const target = state.doc.nodeAt(pos);
    if (!target || target.type.name !== "geometryDiagram" || target.attrs?.diagramId) return;
    const id = `D-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const tr = state.tr.setNodeMarkup(pos, undefined, { ...target.attrs, diagramId: id });
    tr.setMeta("addToHistory", false);
    dispatch(tr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── DRAG THE WHOLE DIAGRAM (outside Diagram 2D mode) ──────────────────
  // Geometry Mode OFF → the diagram is a movable workspace object: pressing on
  // it and dragging moves the entire figure (geometry, points, labels, angles,
  // lines, circles, annotations) because the whole scene travels with the node.
  // Geometry Mode ON  → unchanged Diagram 2D behaviour: select and edit.
  // A press without movement still activates the diagram, as before.
  const { mode: geometryModeOn } = useGeometryMode();

  // A diagram is a DOCUMENT BLOCK. It never leaves the flow, so it can never
  // be dragged over text: pressing it simply activates it for drawing.
  const handlePointerDown = (e: React.PointerEvent) => {
    kickAi();
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return;
    if (selected) return;
    pendingClick.current = { x: e.clientX, y: e.clientY };
    tiptapEditor.commands.setNodeSelection(pos);
  };

  // ── OWN VERTICAL REGION ────────────────────────────────────────────────
  // The block reserves real height in the document, so the text underneath
  // always starts below the figure. Dragging the lower barrier grows the region
  // and pushes the following content down; shrinking pulls it back up.
  const MIN_REGION = 160;
  const DEFAULT_REGION = 320;
  const storedHeight = Math.max(0, Number(node.attrs.height) || 0);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const regionHeight = dragHeight ?? storedHeight;

  // BARRIERS — the real boundary of the 2D workspace. They are pure mode UI:
  // never nodes, never saved, never printed, never shown in other modes.
  // Between them is the drawable region; left/right are the page edges.
  const barriersOn = !!geometryModeOn && !!selected;
  const barrierHeight = Math.max(MIN_REGION, regionHeight || DEFAULT_REGION);
  // Measured page width of the region, so the drawing surface covers the whole
  // space between the barriers instead of a fixed box inside it.
  const [regionWidth, setRegionWidth] = useState(0);
  useEffect(() => {
    if (!barriersOn) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setRegionWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [barriersOn]);

  // Entering 2D on a fresh figure opens a usable drawing region straight away.
  useEffect(() => {
    if (!barriersOn) return;
    if (storedHeight >= MIN_REGION) return;
    updateAttributes({ height: DEFAULT_REGION });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barriersOn]);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const base = wrapRef.current?.getBoundingClientRect().height ?? storedHeight;
    let next = Math.max(MIN_REGION, Math.round(base));
    const onMove = (ev: PointerEvent) => {
      // Clamped: the lower barrier can never rise above the fixed upper one.
      next = Math.max(MIN_REGION, Math.round(base + (ev.clientY - startY)));
      setDragHeight(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragHeight(null);
      updateAttributes({ height: next });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const nudge = (delta: number) => {
    const base = regionHeight || DEFAULT_REGION;
    updateAttributes({ height: Math.max(MIN_REGION, Math.round(base + delta)) });
  };

  return (
    <NodeViewWrapper
      data-geometry-diagram-node="true"
      className={cn("my-5 flex w-full clear-both relative", containerAlign)}
      contentEditable={false}
      style={barriersOn ? { minHeight: barrierHeight } : undefined}
    >
      {barriersOn && (
        <>
          {/* FIXED UPPER BARRIER — full page width, never moves. */}
          <div
            data-geometry-barrier="upper"
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-0 h-0 border-t-2 border-geometry-barrier"
          />
          {/* MOVABLE LOWER BARRIER — carries move up / move down / delete. */}
          <div
            data-geometry-barrier="lower"
            className="absolute left-0 right-0 bottom-0 h-0 border-t-2 border-geometry-barrier"
          >
            <div
              className="absolute right-2 -top-4 z-20 inline-flex items-center rounded border border-geometry-barrier bg-background/95 shadow-sm"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title="Move the lower barrier up (less drawing space)"
                aria-label="Move the lower barrier up"
                className="px-1.5 py-0.5 text-[11px] text-foreground hover:bg-foreground/10"
                onClick={(e) => { e.stopPropagation(); nudge(-60); }}
              >
                ▲
              </button>
              <span
                title="Drag to resize the drawing area"
                onPointerDown={startResize}
                className="cursor-ns-resize select-none border-x border-foreground/20 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                ⇕
              </span>
              <button
                type="button"
                title="Move the lower barrier down (more drawing space)"
                aria-label="Move the lower barrier down"
                className="px-1.5 py-0.5 text-[11px] text-foreground hover:bg-foreground/10"
                onClick={(e) => { e.stopPropagation(); nudge(60); }}
              >
                ▼
              </button>
              <button
                type="button"
                title="Close the 2D workspace"
                aria-label="Close the 2D workspace"
                className="border-l border-foreground/20 px-1.5 py-0.5 text-foreground/70 hover:bg-foreground/10 hover:text-red-500"
                onClick={(e) => { e.stopPropagation(); deleteNode(); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </>
      )}
      <div
        ref={wrapRef}
        data-geometry-diagram-wrapper="true"
        data-geometry-pos={typeof getPos === "function" ? String(getPos()) : undefined}
        className="relative inline-block"
        style={{
          overflow: "visible",
          ...(barriersOn
            ? { minHeight: barrierHeight, width: "100%" }
            : regionHeight ? { minHeight: regionHeight } : null),
        }}

        onMouseEnter={kickAi}
        onMouseMove={kickAi}
        onFocus={kickAi}
        onPointerDown={handlePointerDown}
      >



        {selected ? (
          <LiveEditor
            instanceId={instanceId}
            scene={scene}
            onChange={commitScene}
            docHistory={docHistory}
            zoom={diagramZoom}
            onDeleteDiagram={() => deleteNode()}
            relevanceText={(node.attrs.questionText as string) || undefined}
            // The map always reads the diagram's OWN question — never the caret's.
            getMapContext={() => {
              const at = typeof getPos === "function" ? getPos() : null;
              return questionContextForOwner(
                tiptapEditor.state.doc,
                (node.attrs.ownerQuestionId as string | null) ?? null,
                at ?? null,
              );
            }}
            onOpenSolution={() => {
              const at = typeof getPos === "function" ? getPos() : null;
              const owner = (node.attrs.ownerQuestionId as string | null) ?? null;
              const headingPos = owner
                ? questionHeadingPos(tiptapEditor.state.doc, owner)
                : null;
              const target = headingPos != null ? headingPos + 1 : at;
              if (target == null) return;
              tiptapEditor.chain().focus().setTextSelection(target).run();
              tiptapEditor.view.dom
                .querySelector<HTMLElement>("[data-solution-anchor]")
                ?.scrollIntoView({ block: "center" });
            }}
          />

        ) : (
          <StudentGuideDiagram scene={scene} zoom={diagramZoom} />
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
            <DiagramZoomControl zoom={diagramZoom} onZoom={setDiagramZoom} compact className="border-0 bg-transparent shadow-none" />
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
              title="AI Edit"
            >
              <Sparkles className="h-3 w-3" /> AI Edit
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

        {/* Grow / shrink the diagram's own document region. No frame, no
            border — only this small grip appears while the diagram is active. */}
        {selected && (
          <div
            onPointerDown={startResize}
            title="Drag to give the diagram more room"
            className="absolute left-1/2 -translate-x-1/2 -bottom-2 h-1.5 w-16 cursor-ns-resize rounded-full bg-foreground/25 hover:bg-foreground/40"
          />
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
  relevanceText,
  getMapContext,
  onOpenSolution,
  zoom,
}: {
  instanceId: string;
  scene: GeometryScene;
  /** Uniform visual zoom for this diagram (never changes the geometry). */
  zoom?: number;
  /** Owning question text — drives the generated-diagram label clean-up. */
  relevanceText?: string;
  onChange: (next: GeometryScene, opts?: { addToHistory?: boolean }) => void;
  /** When hosted inside a lesson note, Undo/Redo drive the DOCUMENT history
   *  so text, diagrams, edits and deletions share one chronological stack. */
  docHistory?: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
  onDeleteDiagram?: () => void;
  /** Reads this question and its solution — the Geometry Map is built from it. */
  getMapContext?: () => DiagramQuestionContext;
  onOpenSolution?: () => void;
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
  const editor = useGeometryEditor(scene, handleChange, relevanceText);
  const { tool: modeTool } = useGeometryMode();
  const [propertiesOpen, setPropertiesOpen] = useState(false);

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
      onOpenProperties={() => setPropertiesOpen(true)}
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


  return (
    <>
      <GeometryCanvas editor={editor} zoom={zoom} />
      {propertiesOpen && (
        <GeometryPropertiesWorkspace
          scene={editor.scene}
          onChange={(next) => editor.commit(next)}
          onClose={() => setPropertiesOpen(false)}
          context={getMapContext?.()}
          onOpenSolution={onOpenSolution}
          topic={relevanceText}
        />
      )}
    </>
  );
}

/**
 * Read-only view of a lesson-note diagram: the same structured diagram object
 * plus the published guide. When the teacher has attached Geometry Properties
 * to THIS diagram, a small property bar appears underneath it and opens the
 * existing Review Properties panel for that diagram only. With no properties
 * the diagram is simply view-only — no bar at all.
 */
function StudentGuideDiagram({ scene, zoom }: { scene: GeometryScene; zoom?: number }) {
  const [ids, setIds] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const diff = useMemo(
    () => (ids.length
      ? { added: new Set(ids), removed: new Set<string>(), changed: new Set<string>() }
      : undefined),
    [ids],
  );
  const hasProperties = useMemo(
    () => sceneHasReviewableProperties(scene, "teacher"),
    [scene],
  );
  return (
    <>
      <StaticGeometryDiagram scene={scene} diff={diff} zoom={zoom} />
      <GeometryGuideView scene={scene} onHighlight={setIds} />
      {hasProperties && (
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setReviewOpen(true); }}
            className="inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-background/80 px-2 py-[2px] text-[10.5px] text-foreground/70 hover:bg-foreground/5"
            title="Review the Geometry Properties of this diagram"
          >
            <Shapes className="h-3 w-3" /> Geometry Properties
          </button>
        </div>
      )}
      {reviewOpen && (
        <SmartboardPropertyTest scene={scene} onClose={() => setReviewOpen(false)} />
      )}
    </>
  );
}




function GeometryDiagramNodeView(props: NodeViewProps) {
  // Legacy page-layer carriers are rendered as ordinary in-flow diagrams; the
  // notebook migration clears the flag the first time the note is opened.
  return <GeometryDiagramView {...props} />;
}


export function PresentationGeometryDiagram({
  scene, pageLayer, highlightIds, onPickObject, zoom,
}: {
  scene: GeometryScene;
  pageLayer?: boolean;
  /** Board zoom — the diagram scales with the writing, keeping proportions. */
  zoom?: number;
  /** Review Properties: object ids to light up. */
  highlightIds?: string[];
  /** Review Properties: report the clicked object's stable id. */
  onPickObject?: (id: string) => void;
}) {
  const groups = useMemo(
    () => pageLayer ? splitPageGeometryScene(scene) : [scene],
    [scene, pageLayer],
  );
  return (
    <div className="sb-geometry-groups">
      {groups.map((group, index) => (
        <StaticGeometryDiagram
          key={`${index}-${group.objects.map((o) => o.id).join("-")}`}
          scene={group}
          presentation
          className="sb-geometry-diagram"
          zoom={zoom}
          highlightIds={highlightIds}
          onPickObject={onPickObject}
        />
      ))}
    </div>
  );
}


/**
 * Note-scale read-only diagram (Highlighting page, Floating Numbers page).
 * It crops the empty notebook canvas so the figure reads exactly as it does in
 * the lesson note — never a giant mostly-empty sheet — and keeps lesson-note
 * ink weight (the board, not this, strengthens ink).
 */
export function InlineGeometryDiagram({ scene, pageLayer }: { scene: GeometryScene; pageLayer?: boolean }) {
  const groups = useMemo(
    () => (pageLayer ? splitPageGeometryScene(scene) : [scene]),
    [scene, pageLayer],
  );
  return (
    <>
      {groups.map((group, index) => (
        <StaticGeometryDiagram
          key={`${index}-${group.objects.map((o) => o.id).join("-")}`}
          scene={group}
          crop
        />
      ))}
    </>
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
      // Stable identity so the Solution (and Floating/highlight actions) can
      // REFERENCE this exact diagram instead of generating another one.
      diagramId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-diagram-id") || null,
        renderHTML: (attrs) =>
          attrs.diagramId ? { "data-diagram-id": attrs.diagramId } : {},
      },
      topic: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-topic") || null,
        renderHTML: (attrs) =>
          attrs.topic ? { "data-topic": attrs.topic } : {},
      },
      // The owning question text. Present only on AI-generated diagrams; it
      // is the source of truth for which point labels stay visible.
      questionText: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-question-text") || null,
        renderHTML: (attrs) =>
          attrs.questionText ? { "data-question-text": attrs.questionText } : {},
      },
      // Permanent question ownership for diagrams inserted or detached from
      // the flowing note. Presentation placement must not depend on where a
      // free-positioned wrapper happens to sit in document JSON.
      ownerQuestionId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-owner-question-id") || null,
        renderHTML: (attrs) =>
          attrs.ownerQuestionId ? { "data-owner-question-id": attrs.ownerQuestionId } : {},
      },

      // The notebook-wide 2D layer. A diagram drawn straight onto the page is
      // rendered by the page overlay, but it MUST also live in the document so
      // it is saved with the note and reaches the Smartboard. That node is
      // flagged pageLayer and renders nothing of its own (no double drawing).
      pageLayer: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-page-layer") === "true",
        renderHTML: (attrs) => (attrs.pageLayer ? { "data-page-layer": "true" } : {}),
      },

      // The vertical room this block reserves in the document (0 = natural).
      height: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-height")) || 0,
        renderHTML: (attrs) =>
          attrs.height ? { "data-height": String(attrs.height) } : {},
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
    return ReactNodeViewRenderer(GeometryDiagramNodeView);
  },
});
