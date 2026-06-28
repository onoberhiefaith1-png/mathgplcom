// useGeometryEditor — wires scene + tool + history together.

import { useCallback, useMemo, useRef, useState } from "react";
import type { GeometryScene, GeoId, GeoObject } from "@/lib/geometry/scene";
import type { ToolId } from "@/lib/geometry/editor/tools";
import { emptyHistory, push, undo, redo, type History } from "@/lib/geometry/editor/history";
import type { OpResult } from "@/lib/geometry/editor/sceneOps";

export interface UseGeometryEditorReturn {
  scene: GeometryScene;
  tool: ToolId;
  setTool: (t: ToolId) => void;
  apply: (op: OpResult) => void;
  /** Apply a function that produces the next scene; pushes to history. */
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

  const commit = useCallback((next: GeometryScene) => {
    setHistory((h) => push(h, scene));
    setScene(next);
    onChange(next);
  }, [scene, onChange]);

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
    setHistory(r.history);
    setScene(r.scene);
    onChange(r.scene);
  }, [history, scene, onChange]);

  const doRedo = useCallback(() => {
    const r = redo(history, scene);
    if (!r) return;
    setHistory(r.history);
    setScene(r.scene);
    onChange(r.scene);
  }, [history, scene, onChange]);

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
  };
}
