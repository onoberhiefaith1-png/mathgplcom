import { buildAssessmentBoardSource, type AssessmentQuestion } from "@/lib/assessments/assessmentBoardSource";
import type { QuestionDesign } from "@/lib/academia/questionDesign.functions";
import type { QuestionVideoConfig } from "@/lib/courses/questionVideo";
import type { FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import type { GameQuestionBoard } from "@/lib/slate/gameBoard";
import type { Game } from "@/lib/slate/types";
import { equationsMatch } from "@/lib/smartboard/rowAscii";

export const ACADEMIA_PACK_SCHEMA = 4;

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

/** Compile the same single-question board contract for connected and offline play. */
export function compileOfflineBoard(params: {
  activityId: string;
  subsectionId: string;
  notebookId?: string | null;
  title: string;
  lines: FloatingLine[];
  /** The question block above the solution (Line 0), as connected Practice uses. */
  questionText?: string | null;
}): GameQuestionBoard | null {
  const { activityId, subsectionId, notebookId = "offline", title } = params;
  const usable = params.lines.filter((line) => typeof line?.equation === "string" && line.equation.trim());
  const asked = (params.questionText ?? "").trim();
  const squash = (v: string) => v.replace(/\s+/g, "");
  const firstRestates = !!asked && !!usable[0] && (squash(usable[0].equation) === squash(asked) || equationsMatch(usable[0].equation, asked));
  // Only a verbatim restatement of the question is Line 0; otherwise every line is work.
  const dropFirst = asked ? firstRestates : true;
  const working = dropFirst ? usable.slice(1) : usable;
  if (working.length < 1) return null;
  const questionLine = dropFirst ? usable[0] : ({ ...usable[0], equation: asked } as FloatingLine);
  const questionTimer = dropFirst ? questionLine.timerSeconds : undefined;
  const boardQuestionId = `${subsectionId}-q`;
  const question: AssessmentQuestion = {
    id: boardQuestionId,
    questionText: dropFirst ? questionLine.equation : asked,
    lines: working.map((line, index) => ({
      lineId: line.lineId || `${subsectionId}-line-${index + 1}`,
      chips: Array.isArray(line.fillers) ? line.fillers.map(String) : [],
      containers: Array.isArray(line.containers) ? line.containers : [],
      equation: line.equation,
      marks: Math.max(0, Number(line.marks) || 0),
      note: line.explanation?.trim() || undefined,
      table: line.table,
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
    lineNoteOnly: question.lines.map(() => false),
    lineHasFloatingNumbers: question.lines.map((line) => line.chips.length > 0),
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
  return [...ids];
}