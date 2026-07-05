// Engine A — Floating Number Display (classroom teaching mode).
//
// This engine renders `LessonModel` through the floatingChannel path.
// It MUST NOT import from the Present Mode engine, and vice versa.
// The only shared code is the board primitive (`boardWriter/ledger`,
// `boardWriter/directWrite`) plus the `LessonModel` itself.
//
// Behavior is preserved verbatim from today's Floating Number panel:
// sensor + chip taps + note button + auto-advance.

import type { LessonModel, ModelSolutionLine } from "@/lib/smartboard/preview/model";
import { solutionLinesFor } from "@/lib/smartboard/preview/model";
import {
  floatingWriteNote,
  type FloatingChannelHost,
} from "@/lib/smartboard/boardWriter/floatingChannel";

export interface FloatingEngineDeps {
  model: LessonModel;
  host: FloatingChannelHost;
}

/** Write the teacher note for a given solution line via the floating
 *  channel. Returns the row it landed on, or null when there is no
 *  note (the model omits notes by law when the source is empty). */
export const floatingWriteNoteForLine = (
  deps: FloatingEngineDeps,
  beatId: string,
  lineIdx: number,
): number | null => {
  const line = solutionLinesFor(deps.model, beatId)[lineIdx];
  if (!line?.note) return null;
  return floatingWriteNote(lineIdx, line.note.text, deps.host);
};

/** Ordered chips for the active line, sourced from the model only. */
export const floatingChipsForLine = (
  model: LessonModel,
  beatId: string,
  lineIdx: number,
): string[] => {
  const line: ModelSolutionLine | undefined = solutionLinesFor(model, beatId)[lineIdx];
  return line?.fragments ?? [];
};
