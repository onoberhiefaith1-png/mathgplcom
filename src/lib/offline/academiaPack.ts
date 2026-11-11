import { compileInlineMcq } from "@/lib/assessments/compileInlineMcq";
import { buildAssessmentBoardSource, type AssessmentQuestion } from "@/lib/assessments/assessmentBoardSource";
import type { QuestionDesign } from "@/lib/academia/questionDesign.functions";
import type { QuestionVideoConfig } from "@/lib/courses/questionVideo";
import type { FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import type { GameQuestionBoard } from "@/lib/slate/gameBoard";
import type { Game } from "@/lib/slate/types";
import type { SolutionObject } from "@/lib/floating/solutionItems";
import { equationsMatch } from "@/lib/smartboard/rowAscii";
import { adoptLineIdentities, type IdentifiedHighlight } from "@/lib/lessonnotes/lineIdentity";
import { compileAuthoredFloatingLines, withResolvedChips } from "@/lib/lessonnotes/authoredFloatingLines";

/** Read-only: copy each line's OWN authored highlight note (`precedingNotebook`)
 *  onto it as `notebook`, joined by permanent identity exactly as the connected
 *  Smartboard does. Equations, chips, marks and line ids are never changed. */
export function withAuthoredNotes<L extends FloatingLine>(lines: L[], highlights: unknown, questionId?: string): (L & { notebook?: string })[] {
  const rows = (Array.isArray(highlights) ? highlights : []) as IdentifiedHighlight[];
  if (!rows.length || !lines.length) return lines;
  const adopted = adoptLineIdentities(rows, lines as never[], questionId);
  const noteByUid = new Map<string, string>();
  for (const h of adopted.highlights) {
    const note = String(h?.precedingNotebook ?? "").trim();
    if (h?.uid && h.notebookOnly !== true && note) noteByUid.set(h.uid, note);
  }
  const uidOf = (line: L, index: number): string | undefined =>
    (line as { sourceUid?: string }).sourceUid
    ?? (adopted.lines.length === lines.length ? (adopted.lines[index] as { sourceUid?: string })?.sourceUid : undefined);
  const withNotes = lines.map((line, index) => {
    const uid = uidOf(line, index);
    const note = uid ? noteByUid.get(uid) : undefined;
    return note ? { ...line, notebook: note } : line;
  });
  // Standalone guidance rows (notebookOnly highlights, e.g. "Compare") keep
  // their authored place: each sits before the next equation highlight's line,
  // trailing ones after the last line. They carry no equation, chips or marks.
  const indexByUid = new Map<string, number>();
  withNotes.forEach((line, index) => { const uid = uidOf(line, index); if (uid && !indexByUid.has(uid)) indexByUid.set(uid, index); });
  const before = new Map<number, (L & { notebook?: string })[]>();
  let pending: (L & { notebook?: string })[] = [];
  for (const h of adopted.highlights) {
    if (h?.notebookOnly === true) {
      const note = String(h.precedingNotebook ?? "").trim();
      if (note) pending.push({ lineId: String(h.uid ?? `note-${pending.length}`), equation: "", fillers: [], containers: [], arrangement: [], marks: 0, notebook: note, noteOnly: true } as unknown as L & { notebook?: string });
      continue;
    }
    const at = h?.uid ? indexByUid.get(h.uid) : undefined;
    if (at === undefined || !pending.length) continue;
    before.set(at, [...(before.get(at) ?? []), ...pending]);
    pending = [];
  }
  const out: (L & { notebook?: string })[] = [];
  withNotes.forEach((line, index) => { out.push(...(before.get(index) ?? []), line); });
  return [...out, ...pending];
}

/** 7: lines carry the authored highlight note (`notebook`). 8: standalone guidance rows. 9: pack lines follow the website highlight walk (pre/post-table floating lines, diagrams as notes). Saved packs re-download once. */
export const ACADEMIA_PACK_SCHEMA = 10;

export type OfflinePackLine = FloatingLine & { id: string; marks: number };

export type OfflineGameBundle = {
  game: Game;
  board: GameQuestionBoard;
  startingLives: number;
  assetUrls: Record<string, string>;
};

export type FullPackActivity = {
  id: string;
  title: string;
  kind?: string;
  mcq?: import("./extendedActivities").OfflinePaper | null;
  adventure?: import("./extendedActivities").OfflineAdventure | null;
  lines: OfflinePackLine[];
  questionDesign: QuestionDesign | null;
  imageUrl: string | null;
  practiceVideo: QuestionVideoConfig | null;
  playVideo: QuestionVideoConfig | null;
  practiceVideoUrl: string | null;
  playVideoUrl: string | null;
  game: OfflineGameBundle | null;
  /** Practice board, present even when no Game is attached. */
  board: GameQuestionBoard | null;
  questionText: string | null;
};

const positiveSeconds = (value: unknown): number | null => {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : null;
};

/** The teacher's chips in their saved shuffle order (same rule as the Smartboard). */
export function shuffledChips(line: { fillers?: unknown; arrangement?: unknown }): string[] {
  const chips = Array.isArray(line.fillers) ? line.fillers.map(String) : [];
  const arr = Array.isArray(line.arrangement) ? line.arrangement.map(Number) : null;
  const valid = !!arr && arr.length === chips.length
    && new Set(arr).size === arr.length && arr.every((i) => Number.isInteger(i) && i >= 0 && i < chips.length);
  return valid ? arr!.map((i) => chips[i]!) : chips;
}


/** Pack lines compiled with the same highlight walk as the website Smartboard. */
export function packActivityLines(floatingLines: unknown, highlights: unknown, subsectionId?: string, questionKey?: string | null): OfflinePackLine[] {
  const compiled = withResolvedChips(compileAuthoredFloatingLines({
    lines: floatingLines,
    highlights,
    questionId: subsectionId,
    questionKey,
  }));
  return compiled.map((line, index) => ({
    ...line,
    id: line.lineId || `line-${index + 1}`,
    lineId: line.lineId || `line-${index + 1}`,
    marks: Math.max(0, Number(line.marks) || 0),
    fillers: line.fillers,
    arrangement: line.arrangement,
  }));
}


const noteObjectsOf = (line: { noteObjects?: unknown }): SolutionObject[] | undefined => {
  const raw = line.noteObjects;
  return Array.isArray(raw) && raw.length ? raw as SolutionObject[] : undefined;
};

/** Compile the same single-question board contract for connected and offline play. */
export function compileOfflineBoard(params: {
  activityId: string;
  subsectionId: string;
  notebookId?: string | null;
  title: string;
  lines: FloatingLine[];
  /** The question block above the solution (Line 0), as connected Practice uses. */
  questionText?: string | null;
  /** The question's diagrams (and solution note diagrams), lesson-note order. */
  objects?: SolutionObject[] | null;
}): GameQuestionBoard | null {
  const { activityId, subsectionId, notebookId = "offline", title } = params;
  const choice = compileInlineMcq(params.questionText ?? "", `${subsectionId}-q`);
  if (choice) {
    const assessmentId = `offline-${activityId}`;
    const question = { ...choice.question, objects: params.objects ?? undefined,
      lines: choice.question.lines.map(line => ({ ...line, equation: choice.answerKey.equationAscii })) };
    return { questionRowId: activityId, subsectionId, notebookId: notebookId || "offline",
      assessmentId, boardQuestionId: question.id, title, questionText: question.questionText,
      totalMarks: 1, boardSource: buildAssessmentBoardSource({ id: assessmentId, title, questions: [question] }),
      questionTimerSeconds: null, lineTimers: [null], lineIds: question.lines.map(line => line.lineId),
      lineVaults: [null], lineMarks: [1], lineNotes: [null], lineNoteOnly: [false], lineHasFloatingNumbers: [false] };
  }
  const isNoteRow = (line: FloatingLine) => (line as { noteOnly?: boolean }).noteOnly === true && !!String((line as { notebook?: string }).notebook ?? "").trim();
  const all = params.lines.filter((line) => isNoteRow(line) || (typeof line?.equation === "string" && line.equation.trim()));
  const usable = all.filter((line) => !isNoteRow(line));
  const asked = (params.questionText ?? "").trim();
  const squash = (v: string) => v.replace(/\s+/g, "");
  const firstRestates = !!asked && !!usable[0] && (squash(usable[0].equation) === squash(asked) || equationsMatch(usable[0].equation, asked));
  // Only a verbatim restatement of the question is Line 0; otherwise every line is work.
  const dropFirst = asked ? firstRestates : true;
  const working = dropFirst ? all.filter((line) => line !== usable[0]) : all;
  if (!working.some((line) => !isNoteRow(line))) return null;
  if (working.length < 1) return null;
  const questionLine = dropFirst ? usable[0] : ({ ...usable[0], equation: asked } as FloatingLine);
  const questionTimer = dropFirst ? questionLine.timerSeconds : undefined;
  const boardQuestionId = `${subsectionId}-q`;
  const question: AssessmentQuestion = {
    id: boardQuestionId,
    questionText: dropFirst ? questionLine.equation : asked,
    ...(params.objects?.length ? { objects: params.objects } : {}),
    lines: working.map((line, index) => isNoteRow(line) ? {
      lineId: line.lineId || `${subsectionId}-note-${index + 1}`,
      chips: [], containers: [], equation: "", marks: 0,
      note: String((line as { notebook?: string }).notebook).trim(), noteOnly: true,
      noteObjects: noteObjectsOf(line as { noteObjects?: unknown }),
    } : ({
      lineId: line.lineId || `${subsectionId}-line-${index + 1}`,
      chips: shuffledChips(line),
      containers: Array.isArray(line.containers) ? line.containers : [],
      equation: line.equation,
      marks: Math.max(0, Number(line.marks) || 0),
      note: String((line as { notebook?: string }).notebook ?? "").trim() || line.explanation?.trim() || undefined,
      table: line.table,
      noteObjects: noteObjectsOf(line as { noteObjects?: unknown }),
    })),
  };
  const assessmentId = `offline-${activityId}`;
  return {
    questionRowId: activityId,
    subsectionId,
    notebookId: notebookId || "offline",
    assessmentId,
    boardQuestionId,
    title,
    questionText: question.questionText,
    totalMarks: question.lines.reduce((sum, line) => sum + line.marks, 0),
    boardSource: buildAssessmentBoardSource({ id: assessmentId, title, questions: [question] }),
    questionTimerSeconds: positiveSeconds(questionTimer),
    lineTimers: working.map((line) => positiveSeconds(line.timerSeconds)),
    lineIds: question.lines.map((line) => line.lineId),
    lineVaults: working.map((line) => Array.isArray(line.vaults) ? line.vaults : null),
    lineMarks: question.lines.map((line) => line.marks),
    lineNotes: question.lines.map((line) => line.note?.trim() || null),
    lineNoteOnly: question.lines.map((line) => line.noteOnly === true),
    lineHasFloatingNumbers: question.lines.map((line) => line.noteOnly !== true && line.chips.length > 0),
  };
}

/** Every private Game asset reference that the faithful player may request. */
export function gameAssetIds(game: Game): string[] {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const id = typeof value === "string" ? value.trim() : "";
    if (id && !id.startsWith("data:") && !id.startsWith("blob:")) ids.add(id);
  };
  add(game.background?.assetId);
  add(game.settings?.assets?.sun?.assetId);
  for (const track of game.settings?.assets?.audio ?? []) add(track.assetId);
  add(game.settings?.sound?.background?.ref?.path);
  for (const slot of Object.values(game.settings?.sound?.rewards ?? {})) add(slot?.ref?.path);
  for (const clip of game.settings?.completionFlow?.clips ?? []) {
    add(clip.path);
    add(clip.processedPath);
  }
  return [...ids];
}