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
import { liberateShapeLabels } from "@/lib/geometry/editor/liberateLabels";
import type { HitKind } from "@/lib/geometry/editor/snap";

/**
 * `relevanceText` is the owning question/solution text for AI-generated
 * diagrams. When present, auto intersection points the mathematics does not
 * reference are hidden (never deleted). Hand-drawn diagrams pass nothing and
 * therefore keep every construction label exactly as before.
 */
const normalise = (s: GeometryScene, relevanceText?: string): GeometryScene => {
  const base = ensureIntersectionPoints(normalizeScene(liberateShapeLabels(s)));
  return relevanceText ? hideIrrelevantAutoPoints(base, relevanceText) : base;
};


export interface UseGeometryEditorReturn {
  scene: GeometryScene;
  tool: ToolId;
  setTool: (t: ToolId) => void;
  /** Commits the op and returns the scene actually stored (post-normalise). */
  apply: (op: OpResult) => GeometryScene;

  commit: (next: GeometryScene) => GeometryScene;
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
  /** The exact JSON we last pushed upwards — used to ignore our own echo. */
  const emittedJsonRef = useRef<string | null>(null);
  /** Always the freshest scene, so two ops inside one gesture chain safely. */
  const sceneRef = useRef<GeometryScene>(scene);
  /** Pending construction clicks — never discarded by an incoming scene. */
  const pendingRef = useRef<GeoId[]>([]);
  // Push the normalised scene back up on first mount so the notebook
  // persists the split segments (otherwise legacy DE-DO would re-appear
  // on the next reload).
  useEffect(() => {
    const normalised = normalise(initial, relevanceRef.current);
    const json = JSON.stringify(normalised);
    if (json !== initialJson) {
      emittedJsonRef.current = json;
      onChangeRef.current(normalised);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external scene changes back in (e.g. the AI Edit panel writes
  // a new scene to the node attrs).
  //
  // This must NEVER disturb the current selection, the undo history or an
  // in-progress construction for a scene that is effectively the one already
  // on screen: the node-view re-serialises the scene on every attr write, and
  // reloading there wiped the pending clicks — so a circle never got its
  // second point and a polyline never joined to its previous point.
  useEffect(() => {
    if (sceneJsonRef.current === initialJson) return;
    if (emittedJsonRef.current === initialJson) {
      // Our own save coming back — adopt it as the baseline and stop.
      sceneJsonRef.current = initialJson;
      return;
    }
    sceneJsonRef.current = initialJson;
    const next = normalise(initial, relevanceRef.current);
    const nextJson = JSON.stringify(next);
    if (nextJson === JSON.stringify(sceneRef.current)) return; // same content
    // A construction is in flight — never yank the scene out from under it.
    if (pendingRef.current.length > 0) return;
    sceneRef.current = next;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, initialJson]);


  const commit = useCallback((next: GeometryScene): GeometryScene => {
    // Same normalisation as the load path, so a saved scene and a reloaded
    // scene are byte-identical and no phantom reload is triggered.
    const normalised = normalise(next, relevanceRef.current);
    const json = JSON.stringify(normalised);
    if (json === JSON.stringify(sceneRef.current)) return sceneRef.current;
    setHistory((h) => push(h, sceneRef.current));
    sceneRef.current = normalised;
    sceneJsonRef.current = json;
    emittedJsonRef.current = json;
    setScene(normalised);
    onChangeRef.current(normalised);
    return normalised;
  }, []);


  const apply = useCallback((op: OpResult): GeometryScene => {
    if (op.scene === sceneRef.current) return sceneRef.current;
    const stored = commit(op.scene);
    const fl = [...op.addedIds, ...op.changedIds];
    if (fl.length) {
      setFlashIds(fl);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashIds([]), 700);
    }
    return stored;
  }, [commit]);



  const toggleSelected = useCallback((id: GeoId) => {
    setSelectedIdsState((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const selectedObjects = useMemo(() => {
    const realIds = new Set(selectedIds.map((id) => id.split("#")[0]));
    return scene.objects.filter((o) => realIds.has(o.id));
  }, [scene, selectedIds]);


  const doUndo = useCallback(() => {
    const r = undo(history, sceneRef.current);
    if (!r) return;
    const json = JSON.stringify(r.scene);
    sceneJsonRef.current = json;
    emittedJsonRef.current = json;
    sceneRef.current = r.scene;
    setHistory(r.history);
    setScene(r.scene);
    onChangeRef.current(r.scene);
  }, [history]);

  const doRedo = useCallback(() => {
    const r = redo(history, sceneRef.current);
    if (!r) return;
    const json = JSON.stringify(r.scene);
    sceneJsonRef.current = json;
    emittedJsonRef.current = json;
    sceneRef.current = r.scene;
    setHistory(r.history);
    setScene(r.scene);
    onChangeRef.current(r.scene);
  }, [history]);

  const setPending = useCallback((ids: GeoId[]) => {
    pendingRef.current = ids;
    setPendingIds(ids);
  }, []);

  const resetPending = useCallback(() => setPending([]), [setPending]);

  return {
    scene,
    tool,
    setTool: (t) => {
      if (tool === "curve" && t !== "curve" && pendingIds.length >= 2) {
        commit(addCurve(sceneRef.current, pendingIds).scene);
      }
      setTool(t);
      setPending([]);
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
    setPendingIds: setPending,
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
