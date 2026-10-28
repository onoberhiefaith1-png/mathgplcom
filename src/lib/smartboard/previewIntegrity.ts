// STRUCTURAL VALIDATION — run before the Presentation Preview renders.
//
// The Preview must never silently move a floating number onto a line it does
// not belong to. When the identity graph is broken we say so, in the teacher's
// language, and leave the data alone.

import type { IdentifiedHighlight, IdentifiedLine } from "@/lib/lessonnotes/lineIdentity";

export interface IntegrityIssue {
  kind: "orphan_line" | "duplicate_claim" | "missing_identity" | "cross_question";
  detail: string;
}

export interface IntegrityReport {
  ok: boolean;
  issues: IntegrityIssue[];
  message?: string;
}

export const TEACHER_MESSAGE =
  "Structure error: Some floating numbers could not be matched to their original line. Please review the generated values.";

/** Validate one question's highlight ⇄ floating-line identity graph. */
export const validateQuestionStructure = (
  highlights: IdentifiedHighlight[] | null | undefined,
  lines: IdentifiedLine[] | null | undefined,
  questionId?: string,
): IntegrityReport => {
  const issues: IntegrityIssue[] = [];
  const hs = Array.isArray(highlights) ? highlights : [];
  const ls = Array.isArray(lines) ? lines : [];

  const uids = new Set<string>();
  for (const h of hs) {
    if (typeof h?.uid === "string" && h.uid) uids.add(h.uid);
  }

  // Only chip-bearing lines matter: an empty row carries nothing to misplace.
  const bearing = ls.filter((l) => (l?.fillers?.length ?? 0) > 0);

  for (const line of bearing) {
    const uid = line?.sourceUid;
    if (!uid) {
      issues.push({
        kind: "missing_identity",
        detail: `"${String(line?.equation ?? "").slice(0, 40)}" has no source line.`,
      });
      continue;
    }
    if (!uids.has(uid)) {
      issues.push({
        kind: "orphan_line",
        detail: `"${String(line?.equation ?? "").slice(0, 40)}" points at a line that no longer exists.`,
      });
    }
    if (questionId && line.questionId && line.questionId !== questionId) {
      issues.push({
        kind: "cross_question",
        detail: `"${String(line?.equation ?? "").slice(0, 40)}" belongs to another question.`,
      });
    }
  }

  const seen = new Set<string>();
  for (const line of bearing) {
    const uid = line?.sourceUid;
    if (!uid) continue;
    if (seen.has(uid)) {
      issues.push({
        kind: "duplicate_claim",
        detail: `Two sets of floating numbers claim the same line ("${String(line?.equation ?? "").slice(0, 40)}").`,
      });
    }
    seen.add(uid);
  }

  return issues.length === 0
    ? { ok: true, issues: [] }
    : { ok: false, issues, message: TEACHER_MESSAGE };
};
