// Per-diagram smart geometry state — recognises the scene into parts,
// tracks hover/selection, and manages teacher-curated relationships
// persisted on `scene.meta.relationships` keyed by selection signature.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { GeometryScene } from "@/lib/geometry/scene";
import { recognize } from "@/lib/geometry/smart/recognize";
import { candidateTheorems, type Theorem } from "@/lib/geometry/smart/relations";
import type { SmartGraph, SmartPartBase } from "@/lib/geometry/smart/parts";
import { genId, selectionSignature, type Relationship } from "@/lib/geometry/smart/relationships";

interface SmartGeometryValue {
  graph: SmartGraph;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  selectedIds: string[];
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  selectedParts: SmartPartBase[];
  /** Built-in theorems that match the current selection. */
  theorems: Theorem[];
  /** Combined list: persisted teacher-curated + live theorem suggestions. */
  relationships: Relationship[];
  upsertRelationship: (rel: Relationship) => void;
  removeRelationship: (id: string) => void;
  togglePinned: (id: string) => void;
  toggleHidden: (id: string) => void;
  duplicateRelationship: (id: string) => void;
  /** Replace the entire stored list for current selection (used by Regenerate / AI editor merges). */
  replaceRelationships: (rels: Relationship[]) => void;
  mode: "relation" | "apply";
  setMode: (m: "relation" | "apply") => void;
}

const Ctx = createContext<SmartGeometryValue | null>(null);

interface ProviderProps {
  scene: GeometryScene;
  children: ReactNode;
  onSceneChange?: (next: GeometryScene) => void;
}

export function SmartGeometryProvider({ scene, children, onSceneChange }: ProviderProps) {
  const graph = useMemo(() => recognize(scene), [scene]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Empty by default — generic ("relation") mode reads as cleaner symbolic view.
  const [mode, setMode] = useState<"relation" | "apply">("relation");

  const selectedParts = useMemo(
    () => selectedIds.map((id) => graph.byId.get(id)).filter((p): p is SmartPartBase => !!p),
    [graph, selectedIds],
  );
  const theorems = useMemo(() => candidateTheorems(graph, selectedParts), [graph, selectedParts]);
  const signature = useMemo(() => selectionSignature(selectedParts), [selectedParts]);

  const stored: Relationship[] = useMemo(() => {
    if (!signature) return [];
    const bag = scene.meta?.relationships as Record<string, Relationship[]> | undefined;
    return (bag?.[signature] ?? []) as Relationship[];
  }, [scene, signature]);

  // Combine: persisted entries win; library suggestions surface for any
  // theorem that isn't already represented (so the teacher can promote
  // them by editing/keeping or dismiss them by deleting).
  const relationships: Relationship[] = useMemo(() => {
    if (!signature) return [];
    const dismissedKey = `__dismissed:${signature}`;
    const dismissed: string[] = ((scene.meta?.relationships as any)?.[dismissedKey] ?? []) as string[];
    const haveTheoremIds = new Set(stored.map((r) => r.theoremId).filter(Boolean) as string[]);
    const suggestions: Relationship[] = theorems
      .filter((t) => !haveTheoremIds.has(t.id) && !dismissed.includes(t.id))
      .map((t) => {
        const applied = t.apply(selectedParts, graph);
        return {
          id: `sugg_${t.id}`,
          name: t.name,
          formula: t.formula,
          applied: applied?.equation,
          explanation: applied?.explanation || t.why,
          confidence: "medium" as const,
          source: "library" as const,
          theoremId: t.id,
        };
      });
    return [...stored, ...suggestions].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [signature, stored, theorems, selectedParts, graph, scene]);

  const writeBag = useCallback(
    (mutate: (bag: Record<string, Relationship[]>) => Record<string, Relationship[]>) => {
      if (!onSceneChange || !signature) return;
      const bag = { ...((scene.meta?.relationships as Record<string, Relationship[]>) ?? {}) };
      const next = mutate(bag);
      onSceneChange({
        ...scene,
        meta: { ...(scene.meta ?? {}), relationships: next },
      });
    },
    [onSceneChange, scene, signature],
  );

  const upsertRelationship = useCallback(
    (rel: Relationship) => {
      writeBag((bag) => {
        const list = [...((bag[signature] ?? []) as Relationship[])];
        const idx = list.findIndex((r) => r.id === rel.id);
        if (idx >= 0) list[idx] = rel;
        else list.push(rel);
        bag[signature] = list;
        return bag;
      });
    },
    [writeBag, signature],
  );

  const removeRelationship = useCallback(
    (id: string) => {
      writeBag((bag) => {
        const list = (bag[signature] ?? []) as Relationship[];
        const existing = list.find((r) => r.id === id);
        if (existing) {
          bag[signature] = list.filter((r) => r.id !== id);
        } else {
          // Suggestion (theorem) being dismissed — remember it.
          const theoremId = id.startsWith("sugg_") ? id.slice(5) : null;
          if (theoremId) {
            const key = `__dismissed:${signature}`;
            const prev = (bag[key] as unknown as string[]) ?? [];
            (bag as any)[key] = Array.from(new Set([...prev, theoremId]));
          }
        }
        return bag;
      });
    },
    [writeBag, signature],
  );

  const togglePinned = useCallback(
    (id: string) => {
      const target = relationships.find((r) => r.id === id);
      if (!target) return;
      upsertRelationship({ ...target, pinned: !target.pinned, source: target.source === "library" ? "teacher" : target.source });
    },
    [relationships, upsertRelationship],
  );

  const toggleHidden = useCallback(
    (id: string) => {
      const target = relationships.find((r) => r.id === id);
      if (!target) return;
      upsertRelationship({ ...target, hidden: !target.hidden, source: target.source === "library" ? "teacher" : target.source });
    },
    [relationships, upsertRelationship],
  );

  const duplicateRelationship = useCallback(
    (id: string) => {
      const target = relationships.find((r) => r.id === id);
      if (!target) return;
      upsertRelationship({ ...target, id: genId(), name: `${target.name} (copy)`, source: "teacher", confidence: "teacher" });
    },
    [relationships, upsertRelationship],
  );

  const replaceRelationships = useCallback(
    (rels: Relationship[]) => {
      writeBag((bag) => {
        bag[signature] = rels;
        return bag;
      });
    },
    [writeBag, signature],
  );

  const value: SmartGeometryValue = {
    graph,
    hoveredId,
    setHoveredId,
    selectedIds,
    toggleSelected: (id) =>
      setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    clearSelection: () => setSelectedIds([]),
    selectedParts,
    theorems,
    relationships,
    upsertRelationship,
    removeRelationship,
    togglePinned,
    toggleHidden,
    duplicateRelationship,
    replaceRelationships,
    mode,
    setMode,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSmartGeometry(): SmartGeometryValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSmartGeometry must be used inside SmartGeometryProvider");
  return v;
}
