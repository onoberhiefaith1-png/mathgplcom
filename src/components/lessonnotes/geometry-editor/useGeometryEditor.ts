// useGeometryEditor — wires scene + tool + history together.
// Edits are LIVE: every commit propagates immediately to the lesson note
// via `onChange`. The teacher never has to press a Save button — the
// diagram is part of the document, just like editing text.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeometryScene, GeoId, GeoObject } from "@/lib/geometry/scene";
import type { ToolId } from "@/lib/geometry/editor/tools";
import { emptyHistory, push, undo, redo, type History } from "@/lib/geometry/editor/history";
import type { OpResult } from "@/lib/geometry/editor/sceneOps";

export interface UseGeometryEditorReturn {
  scene: GeometryScene;
  tool: ToolId;
  setTool: (t: ToolId) => void;
  apply: (op: OpResult) => void;
  commit: (next: GeometryScene) => void;
  selectedIds: GeoId[];
  setSelectedIds: (ids: GeoId[]) => void;
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
): UseGeometryEditorReturn {
  const [scene, setScene] = useState<GeometryScene>(initial);
  const [history, setHistory] = useState<History>(emptyHistory());
  const [tool, setTool] = useState<ToolId>("select");
  const [selectedIds, setSelectedIds] = useState<GeoId[]>([]);
  const [pendingIds, setPendingIds] = useState<GeoId[]>([]);
  const [flashIds, setFlashIds] = useState<GeoId[]>([]);
  const flashTimer = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  const sceneJsonRef = useRef(initialJson);

  // Sync external scene changes back in (e.g. the AI Edit panel writes
  // a new scene to the node attrs).
  useEffect(() => {
    if (sceneJsonRef.current === initialJson) return;
    sceneJsonRef.current = initialJson;
    setScene(initial);
    setHistory(emptyHistory());
    setSelectedIds((prev) => (prev.length ? [] : prev));
    setPendingIds((prev) => (prev.length ? [] : prev));
  }, [initial, initialJson]);

  const commit = useCallback((next: GeometryScene) => {
    sceneJsonRef.current = JSON.stringify(next);
    setHistory((h) => push(h, scene));
    setScene(next);
    onChangeRef.current(next);
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
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const selectedObjects = useMemo(
    () => scene.objects.filter((o) => selectedIds.includes(o.id)),
    [scene, selectedIds],
  );

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
    setTool: (t) => { setTool(t); setPendingIds([]); },
    apply,
    commit,
    selectedIds,
    setSelectedIds,
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
