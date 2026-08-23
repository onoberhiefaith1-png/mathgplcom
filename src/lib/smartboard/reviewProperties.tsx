// Review Properties — board-wide state for reviewing the teacher-authored
// Geometry Properties of the diagram currently on the Smartboard.
//
// The board does not own a second geometry viewer: every presented diagram is
// the exact saved lesson-note scene. This tiny store lets that already-rendered
// diagram report clicks and receive highlights, and lets the top bar know
// whether the presented diagram carries any authored properties at all.
//
// Everything is local and synchronous — no fetch, no AI, no regeneration.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { GeometryScene } from "@/lib/geometry/scene";
import { readMap, reviewableMapItems } from "@/lib/geometry/map/model";

export interface ReviewDiagram {
  diagramId: string;
  scene: GeometryScene;
}

interface ReviewState {
  /** Panel open state — closed by default; the diagram keeps the full board. */
  open: boolean;
  /** True when the review runs as its own full-screen relationship page. */
  fullscreen: boolean;
  /** Diagrams currently on the board that carry reviewable properties. */
  candidates: ReviewDiagram[];
  /** The diagram whose properties are being reviewed. */
  active: ReviewDiagram | null;
  selectedObjectId: string | null;
  activePropertyId: string | null;
  highlightIds: string[];
}

const registry = new Map<string, ReviewDiagram>();

let state: ReviewState = {
  open: false,
  fullscreen: false,
  candidates: [],
  active: null,
  selectedObjectId: null,
  activePropertyId: null,
  highlightIds: [],
};

const listeners = new Set<() => void>();

const emit = (patch: Partial<ReviewState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const syncCandidates = () => {
  const candidates = Array.from(registry.values());
  const active = state.active
    && candidates.some((c) => c.diagramId === state.active!.diagramId)
    ? candidates.find((c) => c.diagramId === state.active!.diagramId)!
    : null;
  // The presented diagram changed under us (next question, next section):
  // drop every review selection so nothing from the old diagram survives.
  const dropped = !!state.active && !active;
  emit({
    candidates,
    active,
    ...(dropped
      ? { selectedObjectId: null, activePropertyId: null, highlightIds: [] }
      : {}),
  });
};

export const reviewProperties = {
  setOpen(open: boolean) {
    emit(
      open
        ? { open: true, active: state.active ?? state.candidates[0] ?? null }
        : { open: false, fullscreen: false, active: null, selectedObjectId: null, activePropertyId: null, highlightIds: [] },
    );
  },
  /** Open the review for ONE specific diagram (the icon beside it). */
  openFor(diagram: ReviewDiagram, fullscreen = false) {
    emit({
      open: true,
      fullscreen,
      active: diagram,
      selectedObjectId: null,
      activePropertyId: null,
      highlightIds: [],
    });
  },
  /** A presented diagram announces itself (pass null to withdraw). */
  register(diagram: ReviewDiagram | null, key: string) {
    if (diagram) registry.set(key, diagram);
    else registry.delete(key);
    syncCandidates();
  },
  /** A click on a geometry object inside a presented diagram. */
  pickObject(diagram: ReviewDiagram, objectId: string) {
    emit({
      active: diagram,
      selectedObjectId: objectId,
      // A new object always clears the previous property highlight.
      activePropertyId: null,
      highlightIds: [objectId],
    });
  },
  /** A click on a property in the panel. */
  pickProperty(propertyId: string | null, objectIds: string[]) {
    emit({
      activePropertyId: propertyId,
      highlightIds: propertyId
        ? objectIds
        : state.selectedObjectId
          ? [state.selectedObjectId]
          : [],
    });
  },
  reset() {
    emit({ active: null, selectedObjectId: null, activePropertyId: null, highlightIds: [] });
  },
};

const getSnapshot = () => state;

export function useReviewProperties(): ReviewState & typeof reviewProperties {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => ({ ...snap, ...reviewProperties }), [snap]);
}

/** Subscribe to just the open flag — for the top-bar button. */
export function useReviewOpen(): boolean {
  return useSyncExternalStore(subscribe, () => state.open, () => state.open);
}

/** True when this scene carries at least one property the audience may see. */
export function sceneHasReviewableProperties(
  scene: GeometryScene,
  role: "teacher" | "student",
): boolean {
  try {
    return reviewableMapItems(readMap(scene), role).length > 0;
  } catch {
    return false;
  }
}

/** Stable registration helper for a presented diagram. */
export function useRegisterReviewDiagram(
  key: string,
  diagram: ReviewDiagram | null,
) {
  const register = useCallback(reviewProperties.register, []);
  return { key, diagram, register };
}
