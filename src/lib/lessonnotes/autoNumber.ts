// Automatic problem numbering — "Example 1 → Solution 1", "Classwork 2 →
// Solution 2", and so on. A section never ends up with several problems and
// one detached general solution.
//
// Deliberately conservative: a heading is only renumbered when its text is
// exactly the section label, optionally followed by a number (and optional
// trailing colon). A teacher who wrote "Example: quadratics" keeps their text.

import type { Editor } from "@tiptap/react";
import {
  detectSectionKind,
  REPEATABLE_SECTION_KINDS,
  SECTION_LABELS,
  type SectionKind,
} from "./sectionKinds";

const plainLabel = (text: string, label: string): boolean =>
  new RegExp(`^${label}\\s*\\d*\\s*:?\\s*$`, "i").test(text.trim());

/**
 * Renumber Example / Exercise / Classwork / Homework / Assessment headings and
 * their Solution headings in document order. Returns true when it changed the
 * document. Never added to the undo history — it is bookkeeping, not an edit.
 */
export function applyAutoNumbering(editor: Editor): boolean {
  const { state, dispatch } = editor.view;
  const doc = state.doc;
  const counts = new Map<SectionKind, number>();
  let currentOrdinal: number | null = null;
  const edits: { from: number; to: number; text: string }[] = [];
  // Ordinal of every question heading by its durable id, so a Solution is
  // numbered from the question it BELONGS to, not from whatever came last.
  const ordinalByQuestionId = new Map<string, number>();

  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const text = node.textContent;
    const kind = detectSectionKind(text);
    if (!kind) return;

    let desired: string | null = null;

    if (REPEATABLE_SECTION_KINDS.has(kind)) {
      const label = SECTION_LABELS[kind];
      const n = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, n);
      currentOrdinal = n;
      const sectionId = (node.attrs as any)?.sectionId;
      if (typeof sectionId === "string" && sectionId) ordinalByQuestionId.set(sectionId, n);
      if (plainLabel(text, label)) desired = `${label} ${n}`;
    } else if (kind === "solution") {
      const owner = (node.attrs as any)?.ownerQuestionId;
      const owned = typeof owner === "string" && owner ? ordinalByQuestionId.get(owner) ?? null : null;
      const ordinal = owned ?? currentOrdinal;
      if (ordinal != null && plainLabel(text, "Solution")) {
        desired = `Solution ${ordinal}`;
      }
    } else {
      currentOrdinal = null;
    }


    if (desired == null || desired === text.trim()) return;
    // Only rewrite a heading whose whole content is one plain text node, so
    // marks, inline math or emoji are never destroyed.
    if (node.childCount !== 1 || !node.firstChild?.isText) return;
    edits.push({ from: pos + 1, to: pos + 1 + node.content.size, text: desired });
  });

  if (!edits.length) return false;

  const tr = state.tr;
  // Apply back-to-front so earlier positions stay valid.
  for (const e of edits.reverse()) {
    tr.insertText(e.text, e.from, e.to);
  }
  tr.setMeta("addToHistory", false);
  tr.setMeta("autoNumber", true);
  dispatch(tr);
  return true;
}
