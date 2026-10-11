import { PHYSICS_LIBRARY } from "./physics";
import { CHEMISTRY_LIBRARY } from "./chemistry";
import type { SubjectEntry, SubjectId, SubjectLibrary } from "./types";

const soon = (id: SubjectId, name: string): SubjectLibrary => ({ id, name, status: "coming-soon", sections: [] });

/** Fixed display order. Mathematics content lives in the existing registry. */
export const SUBJECTS: SubjectLibrary[] = [
  { id: "mathematics", name: "Mathematics", status: "ready", sections: [] },
  PHYSICS_LIBRARY,
  CHEMISTRY_LIBRARY,
  soon("engineering", "Engineering"),
  soon("accounting", "Accounting"),
  soon("economics", "Economics"),
];

export const getSubject = (id: SubjectId) => SUBJECTS.find((s) => s.id === id)!;

/** The tabs shown beside the open subject: every other subject, in order. */
export const alternativeSubjects = (active: SubjectId) => SUBJECTS.filter((s) => s.id !== active);

/** Search within ONE subject only. */
export function searchSubject(lib: SubjectLibrary, query: string): SubjectEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: SubjectEntry[] = [];
  for (const s of lib.sections) for (const en of s.entries) {
    const hay = [en.symbol, en.meaning, en.unit ?? "", s.name, ...(en.alsoMeans ?? [])].join(" ").toLowerCase();
    if (hay.includes(q)) out.push(en);
  }
  return out;
}

export type { SubjectId, SubjectLibrary, SubjectEntry, SubjectSection } from "./types";
