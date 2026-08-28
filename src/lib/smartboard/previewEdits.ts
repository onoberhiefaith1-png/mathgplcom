// APPROVE & GO LIVE is an EDITING surface.
//
// The teacher sees every question exactly as the board will present it —
// equation, its floating numbers underneath, then its note — and edits any of
// the three in place. Every edit is written back to the SAME saved row it was
// read from, matched by durable identity (groupId, then lineId, then the
// equation text). Never by array position.

import { supabase } from "@/integrations/supabase/client";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";

export interface PreviewLineEdit {
  /** Durable highlight identity of the line being edited. */
  groupId?: number;
  lineId?: string;
  /** Original equation as read, used as the last-resort match key. */
  originalEquation: string;
  equation?: string;
  fillers?: string[];
  note?: string;
}

const sameRow = (row: any, edit: PreviewLineEdit): boolean => {
  if (typeof edit.groupId === "number" && typeof row?.groupId === "number") {
    return row.groupId === edit.groupId;
  }
  if (edit.lineId && row?.lineId) return row.lineId === edit.lineId;
  return String(row?.equation ?? "").trim() === edit.originalEquation.trim();
};

/** Persist one line edit into `notebook_subsections`. */
export const savePreviewLineEdit = async (
  subsectionId: string,
  edit: PreviewLineEdit,
): Promise<void> => {
  const { data, error } = await supabase
    .from("notebook_subsections")
    .select("id, floating_lines, floating_highlights")
    .eq("id", subsectionId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "subsection_not_found");

  const lines = Array.isArray((data as any).floating_lines)
    ? ([...(data as any).floating_lines] as any[])
    : [];
  const highlights = Array.isArray((data as any).floating_highlights)
    ? ([...(data as any).floating_highlights] as any[])
    : [];

  const nextEquation =
    edit.equation !== undefined ? normalizeMathSource(edit.equation) : undefined;

  let idx = lines.findIndex((row) => sameRow(row, edit));
  if (idx < 0 && (nextEquation !== undefined || edit.fillers)) {
    lines.push({
      lineId: edit.lineId ?? `line-${Date.now()}`,
      groupId: edit.groupId,
      equation: nextEquation ?? edit.originalEquation,
      fillers: edit.fillers ?? [],
      containers: [],
      arrangement: [],
    });
    idx = lines.length - 1;
  }
  if (idx >= 0) {
    const row = { ...lines[idx] };
    if (nextEquation !== undefined) row.equation = nextEquation;
    if (edit.fillers) {
      row.fillers = edit.fillers.map((f) => normalizeMathSource(f)).filter(Boolean);
      // A rewritten chip set invalidates the old arrangement + selections.
      row.arrangement = row.fillers.map((_: string, i: number) => i);
      row.fillersSelected = row.fillers.map(() => true);
    }
    if (typeof edit.groupId === "number") row.groupId = edit.groupId;
    lines[idx] = row;
  }

  // The note lives on the highlight that authored it — that is the one law for
  // notes, so the board, the assessment compiler and this editor all agree.
  if (edit.note !== undefined) {
    const hIdx = highlights.findIndex((h) => sameRow(h, { ...edit, originalEquation: edit.originalEquation }) || String(h?.payload ?? "").trim() === edit.originalEquation.trim());
    if (hIdx >= 0) {
      highlights[hIdx] = { ...highlights[hIdx], precedingNotebook: edit.note };
    }
  }

  const patch: Record<string, unknown> = { floating_lines: lines };
  if (edit.note !== undefined) patch.floating_highlights = highlights;

  const { error: upErr } = await supabase
    .from("notebook_subsections")
    .update(patch as never)
    .eq("id", subsectionId);
  if (upErr) throw new Error(upErr.message);
};

/** Chips are edited as a single space-separated string of terms. */
export const chipsToText = (fillers: string[]): string => (fillers ?? []).join("  ");
export const textToChips = (text: string): string[] =>
  String(text ?? "")
    .split(/\s{1,}/)
    .map((s) => s.trim())
    .filter(Boolean);
