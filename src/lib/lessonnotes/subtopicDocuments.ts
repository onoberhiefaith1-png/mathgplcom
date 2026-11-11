// Helpers for Topic-notebook subtopics.
//
// The open page is also stored on `notebooks.document_json`, so every existing
// reader keeps working. Each subtopic's own pages live on its
// `notebook_subtopics` row. These helpers keep those rows independent: saving
// or opening C must never write C into A or B.

import { docHasContent, emptyDoc, type Subtopic } from "@/lib/lessonnotes/subtopics";

export { emptyDoc };

export const cloneDoc = (doc: unknown): unknown => {
  if (doc == null) return emptyDoc();
  try {
    return JSON.parse(JSON.stringify(doc));
  } catch {
    return emptyDoc();
  }
};

export const docsEqual = (a: unknown, b: unknown): boolean => {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return a === b;
  }
};

export const storedDocumentFor = (subtopic: Pick<Subtopic, "document_json"> | null | undefined): unknown =>
  subtopic?.document_json != null ? cloneDoc(subtopic.document_json) : emptyDoc();

/** Update exactly one subtopic's stored pages; every other row is left alone. */
export const applySubtopicDocument = <T extends { id: string; document_json: unknown | null }>(
  list: T[],
  id: string | null | undefined,
  doc: unknown,
): T[] => {
  if (!id) return list;
  const copy = cloneDoc(doc);
  return list.map((s) => (s.id === id ? { ...s, document_json: copy } : s));
};

export type OpenSubtopic = {
  activeId: string | null;
  doc: unknown;
  /** Persist the live notebook page onto the chosen subtopic only. */
  writeNotebookToActive: boolean;
};

/**
 * Which subtopic the open notebook page belongs to, and which document to show.
 *
 * If the saved pointer is missing, the live notebook page is treated as the
 * last lesson the teacher worked on — never as the first subtopic. Labelling
 * it as A is what later wrote C into A and B when the teacher clicked away.
 */
export const resolveOpenSubtopic = (
  list: Pick<Subtopic, "id" | "document_json">[],
  savedId: string | null | undefined,
  notebookDoc: unknown,
): OpenSubtopic => {
  if (!list.length) {
    return {
      activeId: null,
      doc: docHasContent(notebookDoc) ? cloneDoc(notebookDoc) : emptyDoc(),
      writeNotebookToActive: false,
    };
  }

  if (savedId && list.some((s) => s.id === savedId)) {
    const active = list.find((s) => s.id === savedId)!;
    if (docHasContent(notebookDoc)) {
      return { activeId: active.id, doc: cloneDoc(notebookDoc), writeNotebookToActive: true };
    }
    return { activeId: active.id, doc: storedDocumentFor(active), writeNotebookToActive: false };
  }

  if (docHasContent(notebookDoc)) {
    const match = [...list].reverse().find((s) => docsEqual(s.document_json, notebookDoc));
    if (match) {
      return { activeId: match.id, doc: cloneDoc(notebookDoc), writeNotebookToActive: false };
    }
    const last = list[list.length - 1]!;
    return {
      activeId: last.id,
      doc: cloneDoc(notebookDoc),
      writeNotebookToActive: !docHasContent(last.document_json),
    };
  }

  const first = list[0]!;
  return { activeId: first.id, doc: storedDocumentFor(first), writeNotebookToActive: false };
};

/** A switch is decided in the same tick as the click: show the target now, and
 *  remember the left-behind lesson to persist in the background. */
export type InstantSwitch = {
  displayId: string;
  displayDoc: unknown;
  persistFrom: { id: string; doc: unknown } | null;
};

export const planInstantSwitch = (args: {
  fromId: string | null;
  fromDoc: unknown;
  targetId: string;
  targetDoc: unknown;
}): InstantSwitch => {
  if (args.targetId === args.fromId) {
    return {
      displayId: args.targetId,
      displayDoc: cloneDoc(args.fromDoc ?? args.targetDoc),
      persistFrom: null,
    };
  }
  return {
    displayId: args.targetId,
    displayDoc: storedDocumentFor({ document_json: args.targetDoc ?? null }),
    persistFrom: args.fromId ? { id: args.fromId, doc: cloneDoc(args.fromDoc) } : null,
  };
};

/** The shared notebooks.document_json row may only receive a save that belongs
 *  to the subtopic currently on screen. A late flush from A must not land on B. */
export const shouldWriteLiveNotebook = (
  ownerId: string | null | undefined,
  liveOwnerId: string | null | undefined,
): boolean => {
  if (!ownerId) return !liveOwnerId;
  return ownerId === liveOwnerId;
};

export const shouldRestoreDraft = (
  draft: { subtopicId?: string | null } | null | undefined,
  openSubtopicId: string | null,
): boolean => {
  if (!draft) return false;
  if (!openSubtopicId) return !draft.subtopicId;
  if (!draft.subtopicId) return true;
  return draft.subtopicId === openSubtopicId;
};
