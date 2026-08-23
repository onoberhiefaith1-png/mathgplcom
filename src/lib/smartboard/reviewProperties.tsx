// Review Properties — board-wide state for reviewing the teacher-authored
// Geometry Properties of the diagram currently on the Smartboard.
//
// The board does not own a second geometry viewer: every presented diagram is
// the exact saved lesson-note scene. This context lets that already-rendered
// diagram report clicks and receive highlights, and lets the top bar know
// whether the presented diagram carries any authored properties at all.
//
// Everything is local and synchronous — no fetch, no AI, no regeneration.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { GeometryScene } from "@/lib/geometry/scene";
import { readProperties } from "@/lib/geometry/properties/model";
import { reviewableItems } from "@/lib/geometry/properties/review";

export interface ReviewDiagram {
  diagramId: string;
  scene: GeometryScene;
}

interface ReviewApi {
  /** Panel open state — closed by default; the diagram keeps the full board. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Diagrams currently on the board that carry reviewable properties. */
  candidates: ReviewDiagram[];
  /** The diagram whose properties are being reviewed. */
  active: ReviewDiagram | null;
  selectedObjectId: string | null;
  activePropertyId: string | null;
  highlightIds: string[];
  /** A presented diagram announces itself (and withdraws on unmount). */
  register: (diagram: ReviewDiagram | null, key: string) => void;
  /** A click on a geometry object inside a presented diagram. */
  pickObject: (diagram: ReviewDiagram, objectId: string) => void;
  /** A click on a property in the panel. */
  pickProperty: (propertyId: string | null, objectIds: string[]) => void;
  reset: () => void;
}

const noop = () => {};

const ReviewPropertiesContext = createContext<ReviewApi>({
  open: false,
  setOpen: noop,
  candidates: [],
  active: null,
  selectedObjectId: null,
  activePropertyId: null,
  highlightIds: [],
  register: noop,
  pickObject: noop,
  pickProperty: noop,
  reset: noop,
});

export function useReviewProperties(): ReviewApi {
  return useContext(ReviewPropertiesContext);
}

/** True when this scene carries at least one property the audience may see. */
export function sceneHasReviewableProperties(
  scene: GeometryScene,
  role: "teacher" | "student",
): boolean {
  try {
    return reviewableItems(readProperties(scene), role).length > 0;
  } catch {
    return false;
  }
}

export function ReviewPropertiesProvider({
  role,
  children,
}: {
  role: "teacher" | "student";
  children: React.ReactNode;
}) {
  const [open, setOpenState] = useState(false);
  const [registry, setRegistry] = useState<Record<string, ReviewDiagram>>({});
  const [active, setActive] = useState<ReviewDiagram | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);

  const register = useCallback((diagram: ReviewDiagram | null, key: string) => {
    setRegistry((prev) => {
      if (!diagram) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key]?.scene === diagram.scene && prev[key]?.diagramId === diagram.diagramId) {
        return prev;
      }
      return { ...prev, [key]: diagram };
    });
  }, []);

  const candidates = useMemo(() => Object.values(registry), [registry]);

  const reset = useCallback(() => {
    setActive(null);
    setSelectedObjectId(null);
    setActivePropertyId(null);
    setHighlightIds([]);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) reset();
  }, [reset]);

  const pickObject = useCallback((diagram: ReviewDiagram, objectId: string) => {
    setActive((prev) =>
      prev && prev.diagramId === diagram.diagramId ? { ...prev, scene: diagram.scene } : diagram,
    );
    setSelectedObjectId(objectId);
    // A new object always clears the previous property highlight.
    setActivePropertyId(null);
    setHighlightIds([objectId]);
  }, []);

  const pickProperty = useCallback((propertyId: string | null, objectIds: string[]) => {
    setActivePropertyId(propertyId);
    setHighlightIds(propertyId ? objectIds : selectedObjectId ? [selectedObjectId] : []);
  }, [selectedObjectId]);

  // The presented diagram changed under us (next question, next section):
  // drop every review selection so nothing from the old diagram survives.
  useEffect(() => {
    if (!active) return;
    if (!candidates.some((c) => c.diagramId === active.diagramId)) reset();
  }, [candidates, active, reset]);

  // When only one reviewable diagram is on the board, it is the review target.
  useEffect(() => {
    if (!open || active || candidates.length !== 1) return;
    setActive(candidates[0]);
  }, [open, active, candidates]);

  const api = useMemo<ReviewApi>(() => ({
    open,
    setOpen,
    candidates,
    active,
    selectedObjectId,
    activePropertyId,
    highlightIds,
    register,
    pickObject,
    pickProperty,
    reset,
  }), [open, setOpen, candidates, active, selectedObjectId, activePropertyId,
      highlightIds, register, pickObject, pickProperty, reset]);

  void role;

  return (
    <ReviewPropertiesContext.Provider value={api}>
      {children}
    </ReviewPropertiesContext.Provider>
  );
}
