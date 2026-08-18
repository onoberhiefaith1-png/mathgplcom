// useGeometryEditor — wires scene + tool + history together.
// Edits are LIVE: every commit propagates immediately to the lesson note
// via `onChange`. The teacher never has to press a Save button — the
// diagram is part of the document, just like editing text.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeometryScene, GeoId, GeoObject } from "@/lib/geometry/scene";
import type { ToolId } from "@/lib/geometry/editor/tools";
import { emptyHistory, push, undo, redo, type History } from "@/lib/geometry/editor/history";
import { addCurve, type OpResult } from "@/lib/geometry/editor/sceneOps";
import { normalizeScene } from "@/lib/geometry/editor/normalize";
import { ensureIntersectionPoints } from "@/lib/geometry/editor/intersections";
import { hideIrrelevantAutoPoints } from "@/lib/geometry/editor/relevance";
import type { HitKind } from "@/lib/geometry/editor/snap";

/**
 * `relevanceText` is the owning question/solution text for AI-generated
 * diagrams. When present, auto intersection points the mathematics does not
 * reference are hidden (never deleted). Hand-drawn diagrams pass nothing and
 * therefore keep every construction label exactly as before.
 */
const normalise = (s: GeometryScene, relevanceText?: string): GeometryScene => {
  const base = ensureIntersectionPoints(normalizeScene(s));
  return relevanceText ? hideIrrelevantAutoPoints(base, relevanceText) : base;
};


export interface UseGeometryEditorReturn {
  scene: GeometryScene;
  tool: ToolId;
  setTool: (t: ToolId) => void;
  apply: (op: OpResult) => void;
  commit: (next: GeometryScene) => void;
  selectedIds: GeoId[];
  setSelectedIds: (ids: GeoId[]) => void;
  selectionKind: HitKind | null;
  setSelectionKind: (k: HitKind | null) => void;
  toggleSelected: (id: GeoId) => void;
  clearSelection: () => void;
  selectedObjects: GeoObject[];
  pendingIds: GeoId[];
  setPendingIds: (ids: GeoId[]) => void;
  resetPending: () => void;
  doUndo: () => void;
  doRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  flashIds: GeoId[];
  /** Always false; kept for legacy callers. */
  dirty: boolean;
  /** No-op; edits are live. Kept for legacy callers. */
  save: () => void;
  /** No-op; use undo. Kept for legacy callers. */
  revert: () => void;
}

export function useGeometryEditor(
  initial: GeometryScene,
  onChange: (s: GeometryScene) => void,
  /** Owning question/solution text — enables the generated-diagram clean-up. */
  relevanceText?: string,
): UseGeometryEditorReturn {
  const relevanceRef = useRef(relevanceText);
  relevanceRef.current = relevanceText;
  const [scene, setScene] = useState<GeometryScene>(() => normalise(initial, relevanceText));
  const [history, setHistory] = useState<History>(emptyHistory());
  const [tool, setTool] = useState<ToolId>("select");
  const [selectedIds, setSelectedIdsState] = useState<GeoId[]>([]);
  const [selectionKind, setSelectionKind] = useState<HitKind | null>(null);
  const setSelectedIds = useCallback((ids: GeoId[]) => {
    setSelectedIdsState(ids);
    if (ids.length === 0) setSelectionKind(null);
  }, []);
  const [pendingIds, setPendingIds] = useState<GeoId[]>([]);
  const [flashIds, setFlashIds] = useState<GeoId[]>([]);
  const flashTimer = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  const sceneJsonRef = useRef(initialJson);
  // Push the normalised scene back up on first mount so the notebook
  // persists the split segments (otherwise legacy DE-DO would re-appear
  // on the next reload).
  useEffect(() => {
    const normalised = normalise(initial, relevanceRef.current);
    if (JSON.stringify(normalised) !== initialJson) {
      onChangeRef.current(normalised);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external scene changes back in (e.g. the AI Edit panel writes
  // a new scene to the node attrs).
  //
  // This must NEVER disturb the current selection for a scene that is
  // effectively the one already on screen: the node-view re-serialises the
  // scene on every attr write (and on the first-mount normalisation pass),
  // and clearing the selection there made a plain click on a line feel
  // "glitchy" — the item was picked and then instantly dropped.
  useEffect(() => {
    if (sceneJsonRef.current === initialJson) return;
    sceneJsonRef.current = initialJson;
    const next = normalise(initial, relevanceRef.current);
    const nextJson = JSON.stringify(next);
    if (nextJson === JSON.stringify(scene)) return; // same content — keep selection
    setScene(next);
    setHistory(emptyHistory());
    // Keep whatever is still present in the incoming scene selected.
    const alive = new Set(next.objects.map((o) => o.id));
    setSelectedIdsState((prev) => {
      const kept = prev.filter((id) => alive.has(id.split("#")[0]));
      if (kept.length === prev.length) return prev;
      if (kept.length === 0) setSelectionKind(null);
      return kept;
    });
    setPendingIds((prev) => (prev.length ? [] : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, initialJson]);


  const commit = useCallback((next: GeometryScene) => {
    const normalised = ensureIntersectionPoints(next);
    sceneJsonRef.current = JSON.stringify(normalised);
    setHistory((h) => push(h, scene));
    setScene(normalised);
    onChangeRef.current(normalised);
  }, [scene]);


  const apply = useCallback((op: OpResult) => {
    if (op.scene === scene) return;
    commit(op.scene);
    const fl = [...op.addedIds, ...op.changedIds];
    if (fl.length) {
      setFlashIds(fl);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashIds([]), 700);
    }
  }, [commit, scene]);

  const toggleSelected = useCallback((id: GeoId) => {
    setSelectedIdsState((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const selectedObjects = useMemo(() => {
    const realIds = new Set(selectedIds.map((id) => id.split("#")[0]));
    return scene.objects.filter((o) => realIds.has(o.id));
  }, [scene, selectedIds]);


  const doUndo = useCallback(() => {
    const r = undo(history, scene);
    if (!r) return;
    sceneJsonRef.current = JSON.stringify(r.scene);
    setHistory(r.history);
    setScene(r.scene);
    onChangeRef.current(r.scene);
  }, [history, scene]);

  const doRedo = useCallback(() => {
    const r = redo(history, scene);
    if (!r) return;
    sceneJsonRef.current = JSON.stringify(r.scene);
    setHistory(r.history);
    setScene(r.scene);
    onChangeRef.current(r.scene);
  }, [history, scene]);

  const resetPending = useCallback(() => setPendingIds([]), []);

  return {
    scene,
    tool,
    setTool: (t) => {
      if (tool === "curve" && t !== "curve" && pendingIds.length >= 2) {
        commit(addCurve(scene, pendingIds).scene);
      }
      setTool(t);
      setPendingIds([]);
    },
    apply,
    commit,
    selectedIds,
    setSelectedIds,
    selectionKind,
    setSelectionKind,
    toggleSelected,
    clearSelection,
    selectedObjects,
    pendingIds,
    setPendingIds,
    resetPending,
    doUndo,
    doRedo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    flashIds,
    dirty: false,
    save: () => { /* no-op: live edits */ },
    revert: () => { /* no-op: use undo */ },
  };
}
