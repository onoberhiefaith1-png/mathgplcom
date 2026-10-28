// LessonModel — the AUTHORITATIVE Preview model.
//
// Architectural contract:
//   Lesson Notes ─► Highlighting ─► Generation ─► LessonModel ─► two engines.
//
// The LessonModel is the ONLY input that either rendering engine
// (Floating Number Display, Present Mode) may consume. Neither engine
// may reach past this model to read notebook rows, floating buckets,
// or highlight payloads directly. Neither engine may import from the
// other.
//
// This module is intentionally a THIN, frozen facade over the existing
// Beat[] + Reservoir[] pipeline. It centralises the invariants the
// user asked for (single source of truth, note-purity, ordering)
// without duplicating the mature builders in `presentation.ts`.

import type { Beat, Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";
import { buildBeats, buildReservoirs } from "@/lib/smartboard/presentation";
import type { SectionRow, NotebookRow } from "@/hooks/useNotebook";
import { noteForLine, noteObjectsForLine } from "@/lib/smartboard/boardWriter/noteSource";
import type { SolutionObject } from "@/lib/floating/solutionItems";

/** A single teacher note, paragraph-preserving. */
export interface TeacherNote {
  /** Original text with paragraph breaks intact. */
  text: string;
  /** One entry per paragraph (blank-line separated), trimmed. */
  paragraphs: string[];
  /** Notes-layer objects (diagrams) that belong to this note. */
  objects: SolutionObject[];
}

/** One solution line inside a solution beat. */
export interface ModelSolutionLine {
  id: string;
  lineIdx: number;
  /** Full equation text (canonical). */
  equationText: string;
  /** Ordered presentation objects for this line — the exact chips the
   *  teacher arranged on the generation page. */
  fragments: string[];
  /** Optional teacher note (paragraph-preserving). Undefined ⇒ no icon. */
  note?: TeacherNote;
  /** True when this line has no equation — only a standalone note. */
  notebookOnly: boolean;
  /** Underlying reservoir line (opaque to engines; kept for parity with
   *  today's controller until the engines are fully typed against the
   *  model alone). */
  raw: ReservoirLine;
}

/** A display beat (cover/intro/example/exercise/summary…) — no sensor. */
export interface DisplayBeat {
  kind: "display";
  beat: Beat;
}

/** A solution beat — the only interactive beat kind. */
export interface SolutionBeat {
  kind: "solution";
  beat: Beat;
  reservoir: Reservoir;
  lines: ModelSolutionLine[];
}

export type ModelBeat = DisplayBeat | SolutionBeat;

export interface LessonModel {
  beats: Beat[];                 // raw beat list (navigation)
  reservoirs: Reservoir[];       // raw reservoirs (indexing)
  solutionsByBeatId: Record<string, SolutionBeat>;
  /** Frozen: engines must treat as read-only. */
  readonly built: true;
}

const paragraphsOf = (text: string): string[] =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

const buildNote = (line: ReservoirLine): TeacherNote | undefined => {
  // Purity + fallback-free note law lives in noteSource; we never
  // synthesize notes from explanations or positional guesses here.
  const text = noteForLine({ notebook: line.notebook }).trim();
  const objects = noteObjectsForLine<SolutionObject>({ noteObjects: line.noteObjects });
  // A note exists when there is prose OR note content (a diagram).
  if (!text && objects.length === 0) return undefined;
  const paras = paragraphsOf(text);
  if (paras.length === 0 && objects.length === 0) return undefined;
  return { text, paragraphs: paras, objects };
};

const buildSolutionLines = (reservoir: Reservoir): ModelSolutionLine[] =>
  reservoir.lines.map((rl, idx) => ({
    id: `${reservoir.beatId}#${idx}`,
    lineIdx: idx,
    equationText: rl.equation ?? "",
    fragments: rl.fillers.slice(),
    note: buildNote(rl),
    notebookOnly: !!rl.notebookOnly,
    raw: rl,
  }));

/** Build the authoritative LessonModel from validated notebook data.
 *  Everything downstream must consume THIS object, not the raw inputs. */
export const buildLessonModel = (
  sections: SectionRow[],
  notebook?: NotebookRow | null,
): LessonModel => {
  const beats = buildBeats(sections, notebook);
  const reservoirs = buildReservoirs(sections);
  const solutionsByBeatId: Record<string, SolutionBeat> = {};
  for (const r of reservoirs) {
    solutionsByBeatId[r.beatId] = {
      kind: "solution",
      beat: beats.find((b) => b.id === r.beatId) ?? {
        id: r.beatId,
        kind: "problem",
        caption: r.caption,
        content: "",
        sectionKind: "example",
        sectionId: r.beatId,
        sectionLabel: r.caption,
      },
      reservoir: r,
      lines: buildSolutionLines(r),
    };
  }
  const model: LessonModel = {
    beats,
    reservoirs,
    solutionsByBeatId,
    built: true,
  };
  return Object.freeze(model);
};

/** Convenience — the ModelBeat for a given beat id (display beats are
 *  wrapped on the fly so engines get a uniform tagged union). */
export const modelBeatFor = (model: LessonModel, beatId: string): ModelBeat => {
  const sol = model.solutionsByBeatId[beatId];
  if (sol) return sol;
  const beat = model.beats.find((b) => b.id === beatId);
  return { kind: "display", beat: beat ?? { id: beatId, kind: "text", content: "", sectionKind: "introduction", sectionId: beatId, sectionLabel: "" } };
};

/** All solution lines for a beat — [] for display beats. Engines use
 *  this to hydrate their own line pickers without reaching past the
 *  model. */
export const solutionLinesFor = (
  model: LessonModel,
  beatId: string,
): ModelSolutionLine[] => model.solutionsByBeatId[beatId]?.lines ?? [];
