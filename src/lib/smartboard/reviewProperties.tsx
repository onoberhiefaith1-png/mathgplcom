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
import { readMap, reviewableMapItems, toggleObjectSelection } from "@/lib/geometry/map/model";

export interface ReviewDiagram {
  diagramId: string;
  scene: GeometryScene;
  /** Owning notebook, used for per-notebook relationship-view preferences. */
  notebookId?: string;
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
  /** Parts the user tapped, in order; properties must reference all of them. */
  selectedObjectIds: string[];
  activePropertyId: string | null;
  highlightIds: string[];
}

const registry = new Map<string, ReviewDiagram>();
const refs = new Map<string, number>();
const owners = new Map<string, string>();
const pendingRemoval = new Set<string>();
let syncQueued = false;
const queueSync = () => {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncCandidates();
  });
};
const releaseOwner = (_key: string, id: string) => {
  const count = (refs.get(id) ?? 1) - 1;
  if (count > 0) { refs.set(id, count); return; }
  refs.delete(id);
  pendingRemoval.add(id);
  queueMicrotask(() => {
    if (!pendingRemoval.has(id)) return;
    pendingRemoval.delete(id);
    if ((refs.get(id) ?? 0) > 0) return;
    registry.delete(id);
    queueSync();
  });
};

let state: ReviewState = {
  open: false,
  fullscreen: false,
  candidates: [],
  active: null,
  selectedObjectIds: [],
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
  const same = candidates.length === state.candidates.length
    && candidates.every((c, i) => c === state.candidates[i]);
  if (same && active === state.active) return;
  emit({
    candidates,
    active,
    ...(dropped
      ? { selectedObjectIds: [], activePropertyId: null, highlightIds: [] }
      : {}),
  });
};

export const reviewProperties = {
  setOpen(open: boolean) {
    emit(
      open
        ? { open: true, active: state.active ?? state.candidates[0] ?? null }
        : { open: false, fullscreen: false, active: null, selectedObjectIds: [], activePropertyId: null, highlightIds: [] },
    );
  },
  /** Open the review for ONE specific diagram (the icon beside it). */
  openFor(diagram: ReviewDiagram, fullscreen = false) {
    emit({
      open: true,
      fullscreen,
      active: diagram,
      selectedObjectIds: [],
      activePropertyId: null,
      highlightIds: [],
    });
  },
  /** Leave the relationship page and return to the board unchanged. */
  close() {
    emit({
      open: false,
      fullscreen: false,
      active: null,
      selectedObjectIds: [],
      activePropertyId: null,
      highlightIds: [],
    });
  },
  /** A presented diagram announces itself (pass null to withdraw). */
  register(diagram: ReviewDiagram | null, key: string) {
    // Identity is the permanent diagramId (not the per-mount key), with a
    // per-key owner map so remounts never look like a brand-new diagram.
    if (diagram) {
      const prevId = owners.get(key);
      if (prevId === diagram.diagramId) {
        const entry = registry.get(diagram.diagramId);
        if (entry) { entry.scene = diagram.scene; entry.notebookId = diagram.notebookId; }
        return;
      }
      if (prevId) releaseOwner(key, prevId);
      owners.set(key, diagram.diagramId);
      const pending = pendingRemoval.has(diagram.diagramId);
      if (pending) pendingRemoval.delete(diagram.diagramId);
      const count = (refs.get(diagram.diagramId) ?? 0) + 1;
      refs.set(diagram.diagramId, count);
      const existing = registry.get(diagram.diagramId);
      if (existing) {
        existing.scene = diagram.scene;
        existing.notebookId = diagram.notebookId;
        return;
      }
      registry.set(diagram.diagramId, { ...diagram });
      queueSync();
    } else {
      const prevId = owners.get(key);
      if (!prevId) return;
      owners.delete(key);
      releaseOwner(key, prevId);
    }
  },
  /** A click on a geometry object inside a presented diagram. */
  pickObject(diagram: ReviewDiagram, objectId: string) {
    const same = state.active?.diagramId === diagram.diagramId;
    const next = toggleObjectSelection(same ? state.selectedObjectIds : [], objectId);
    emit({
      // The diagram itself is the entry point: the first tap reveals its
      // teacher-authored properties without requiring a separate toolbar tap.
      open: true,
      fullscreen: false,
      active: diagram,
      selectedObjectIds: next,
      // A new object always clears the previous property highlight.
      activePropertyId: null,
      highlightIds: next,
    });
  },
  /** A click on a property in the panel. */
  pickProperty(propertyId: string | null, objectIds: string[]) {
    emit({
      activePropertyId: propertyId,
      highlightIds: propertyId
        ? objectIds
        : state.selectedObjectIds,
    });
  },
  /** Clear every tapped part and highlight, keeping the panel open. */
  resetSelection() {
    emit({ selectedObjectIds: [], activePropertyId: null, highlightIds: [] });
  },
  reset() {
    emit({ active: null, selectedObjectIds: [], activePropertyId: null, highlightIds: [] });
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
