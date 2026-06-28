// Per-diagram smart geometry state — recognises the scene into parts and
// tracks hover / selection. Wrap each diagram NodeView with this provider.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { GeometryScene } from "@/lib/geometry/scene";
import { recognize } from "@/lib/geometry/smart/recognize";
import { candidateTheorems, type Theorem } from "@/lib/geometry/smart/relations";
import type { SmartGraph, SmartPartBase } from "@/lib/geometry/smart/parts";

interface SmartGeometryValue {
  graph: SmartGraph;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  selectedIds: string[];
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  selectedParts: SmartPartBase[];
  theorems: Theorem[];
  mode: "relation" | "apply";
  setMode: (m: "relation" | "apply") => void;
}

const Ctx = createContext<SmartGeometryValue | null>(null);

export function SmartGeometryProvider({ scene, children }: { scene: GeometryScene; children: ReactNode }) {
  const graph = useMemo(() => recognize(scene), [scene]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"relation" | "apply">("apply");

  const selectedParts = useMemo(
    () => selectedIds.map((id) => graph.byId.get(id)).filter((p): p is SmartPartBase => !!p),
    [graph, selectedIds],
  );
  const theorems = useMemo(() => candidateTheorems(graph, selectedParts), [graph, selectedParts]);

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
