// One compiler for the website Smartboard and the Academia pack.
// Highlights in document order are the source of truth. A table object
// expands into the saved workspace lines that belong to it; ordinary
// equation highlights stay as their own lines (never swallowed by the table).
// When there are no highlights, the saved floating_lines are used as-is.

import { adoptLineIdentities, linesByUid } from "@/lib/lessonnotes/lineIdentity";
import type { FloatingLine, FloatingTableRef } from "@/lib/lessonnotes/floatingCompile";
import { readSolutionObjects, isFloatableObject, sortByPlacement } from "@/lib/floating/solutionItems";
import type { SolutionObject } from "@/lib/floating/solutionItems";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";
import { extractTermsFromAscii, dropContextualLeadingPlus } from "@/lib/smartboard/floatingExtractor";
import { expandMatrixFillers, matrixLineChips } from "@/lib/floating/matrixChips";
import { normEq } from "@/lib/smartboard/rowAscii";
import type { ContainerKind } from "@/lib/smartboard/floatingPlan";

export type AuthoredFloatingLine = Omit<FloatingLine, "noteObjects"> & {
  notebook?: string;
  notebookOnly?: boolean;
  noteOnly?: boolean;
  noteObjects?: SolutionObject[];
};

export const lessonSourceKey = (raw: string): string =>
  normEq(toUnicodeMath(String(raw ?? "").trim()));

export const findVerifiedFloatingLine = <L extends { equation?: string; groupId?: number }>(
  payload: string,
  rawLines: L[] | null | undefined,
  groupId?: number,
): L | undefined => {
  if (!rawLines?.length) return undefined;
  if (typeof groupId === "number") {
    const byId = rawLines.find((line) => line?.groupId === groupId);
    if (byId) return byId;
  }
  const key = lessonSourceKey(payload);
  if (!key) return undefined;
  return rawLines.find((line) => lessonSourceKey(line?.equation ?? "") === key);
};

const belongsToQuestion = (item: { questionId?: unknown } | null | undefined, questionKey?: string | null): boolean => {
  if (!questionKey) return true;
  const q = item && typeof item === "object" ? (item as { questionId?: unknown }).questionId : undefined;
  return !q || q === questionKey;
};

const readNoteObjects = (raw: unknown): SolutionObject[] =>
  sortByPlacement(
    readSolutionObjects({ objects: Array.isArray(raw) ? raw : [] }).filter((o) => !isFloatableObject(o)),
  );

/** Diagrams become note-only rows; table objects stay highlightable. */
export const normalizeAuthoredHighlights = (highlights: unknown): any[] =>
  (Array.isArray(highlights) ? highlights : []).map((h: any) => {
    if (!h?.object) return h;
    const object = readSolutionObjects({ objects: [h.object] })[0];
    if (object?.family === "table" || (!h.object.nodeType && h.object.family === "table")) {
      return { ...h, object: object ?? h.object };
    }
    return {
      ...h,
      object: undefined,
      payload: "",
      notebookOnly: true,
      noteObjects: [
        ...(Array.isArray(h.noteObjects) ? h.noteObjects : []),
        h.object,
      ],
    };
  });

const asLines = (raw: unknown): FloatingLine[] =>
  (Array.isArray(raw) ? raw : []).filter((line): line is FloatingLine => !!line && typeof line === "object");

/** A solvable work line without an authored mark still earns 1, never 0. */
export const workLineMarks = (raw: unknown): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

export const compileAuthoredFloatingLines = (opts: {
  lines: unknown;
  highlights?: unknown;
  questionId?: string;
  questionKey?: string | null;
}): AuthoredFloatingLine[] => {
  const allLines = asLines(opts.lines);
  const ownLines = typeof opts.questionKey === "string" && opts.questionKey
    ? allLines.filter((line) => belongsToQuestion(line, opts.questionKey))
    : allLines;
  const savedLines = (ownLines.length ? ownLines : allLines) as FloatingLine[];

  const rawHighlights = normalizeAuthoredHighlights(opts.highlights);
  const ownHighlights = typeof opts.questionKey === "string" && opts.questionKey
    ? rawHighlights.filter((h) => belongsToQuestion(h, opts.questionKey))
    : rawHighlights;
  const highlights = ownHighlights.length ? ownHighlights : rawHighlights;

  if (!highlights.length) {
    return savedLines.map((line) => ({
      ...line,
      noteObjects: readNoteObjects((line as { noteObjects?: unknown }).noteObjects),
    }));
  }

  const identified = adoptLineIdentities(highlights as any[], savedLines as any[], opts.questionId);
  const identifiedHighlights = identified.highlights as typeof highlights;
  const rawIdentified = identified.lines as unknown as FloatingLine[];
  const byIdentity = linesByUid(identified.lines as any[]);

  const out: AuthoredFloatingLine[] = [];
  const claimed = new Set<string>();
  const claim = (line: { lineId?: string; sourceUid?: string } | null | undefined) => {
    if (line?.lineId) claimed.add(`id:${line.lineId}`);
    if (line?.sourceUid) claimed.add(`uid:${line.sourceUid}`);
  };
  const isClaimed = (line: { lineId?: string; sourceUid?: string } | null | undefined) =>
    !!(line && ((line.lineId && claimed.has(`id:${line.lineId}`)) || (line.sourceUid && claimed.has(`uid:${line.sourceUid}`))));

  for (const h of identifiedHighlights) {
    const noteObjects = readNoteObjects((h as any).noteObjects);
    if (h.notebookOnly) {
      const nb = String(h.precedingNotebook ?? "").trim();
      if (!nb && noteObjects.length === 0) continue;
      out.push({
        lineId: String((h as any).uid ?? `note-${out.length}`),
        sourceUid: (h as any).uid,
        equation: "",
        fillers: [],
        containers: [],
        arrangement: [],
        marks: 0,
        notebook: nb || undefined,
        notebookOnly: true,
        noteOnly: true,
        noteObjects: noteObjects.length ? noteObjects : undefined,
      });
      continue;
    }
    if (h.object) {
      const objId = String(h.object?.objId ?? "");
      for (const rl of rawIdentified ?? []) {
        if ((rl as any)?.table?.objId !== objId) continue;
        if (isClaimed(rl)) continue;
        const row: AuthoredFloatingLine = {
          ...(rl as AuthoredFloatingLine),
          equation: String((rl as any).equation ?? ""),
          notebookOnly: false,
          noteOnly: false,
        };
        out.push(row);
        claim(row);
      }
      continue;
    }
    const payload = String(h.payload ?? "").trim();
    const byId = byIdentity.get(String((h as any).uid ?? ""));
    const matched = byId ?? findVerifiedFloatingLine(payload, rawIdentified, (h as any).groupId);
    const ownNotebook = String(h.precedingNotebook ?? "").trim();
    // Equation highlights are never table members: a stray table stamp on the
    // saved row must not swallow the line into the table group.
    const { table: _ignored, ...rest } = (matched ?? {}) as AuthoredFloatingLine & { table?: FloatingTableRef };
    const row: AuthoredFloatingLine = {
      ...rest,
      sourceUid: (h as any).uid,
      groupId: (h as any).groupId,
      equation: payload,
      fillers: Array.isArray((matched as any)?.fillers) ? (matched as any).fillers : [],
      containers: Array.isArray((matched as any)?.containers) ? (matched as any).containers : [],
      arrangement: Array.isArray((matched as any)?.arrangement) ? (matched as any).arrangement : [],
      notebook: ownNotebook || undefined,
      notebookOnly: false,
      noteOnly: false,
      noteObjects: noteObjects.length ? noteObjects : undefined,
      lineId: (matched as any)?.lineId || String((h as any).uid ?? `line-${out.length}`),
      // Work lines must carry a mark so Smartboard, Game and the website stay
      // consistent. Unmatched schema-9 highlights arrived with marks: 0, so
      // solving them turned the line blue without moving the score.
      marks: workLineMarks((matched as any)?.marks),
    };
    delete (row as { table?: FloatingTableRef }).table;
    out.push(row);
    claim(matched ?? row);
  }
  return out;
};

const cleanFragments = (items: string[] | undefined | null): string[] =>
  (items ?? [])
    .map((item) => toUnicodeMath(String(item ?? "")))
    .filter((item) => item && !isStillDirty(item));

const cleanTeacherFragments = (items: string[] | undefined | null): string[] => {
  const kept = (items ?? [])
    .map((item) => String(item ?? ""))
    .filter((item) => item.trim().length > 0);
  return expandMatrixFillers(kept)?.fillers ?? kept;
};

const fillersFromEquation = (equation: string): string[] =>
  dropContextualLeadingPlus(
    extractTermsFromAscii(equation)
      .map((term) => term.ascii)
      .filter(Boolean),
  );

/** Chips in the same teacher-arrangement order the website Smartboard uses. */
export const chipsForAuthoredLine = (line: {
  equation?: string;
  fillers?: string[];
  arrangement?: number[];
  notebookOnly?: boolean;
  noteOnly?: boolean;
}): string[] => {
  const isNotebookOnly = line.notebookOnly === true || line.noteOnly === true;
  if (isNotebookOnly) return [];
  const eq = String(line.equation ?? "").trim();
  const teacherProvided = !!(line.fillers && line.fillers.length > 0);
  const matrixChips = !teacherProvided ? matrixLineChips(eq) : null;
  const baseFills = teacherProvided ? line.fillers as string[] : (matrixChips ?? fillersFromEquation(eq));
  const arr = line.arrangement;
  const ordered = (arr && arr.length === baseFills.length) ? arr.map((i) => baseFills[i]!) : baseFills;
  return teacherProvided || matrixChips
    ? cleanTeacherFragments(ordered)
    : dropContextualLeadingPlus(cleanFragments(ordered));
};

export type ChipReadyAuthoredLine = AuthoredFloatingLine & { fillers: string[]; arrangement: number[] };

export const withResolvedChips = (lines: AuthoredFloatingLine[]): ChipReadyAuthoredLine[] =>
  lines.map((line) => {
    const fillers = chipsForAuthoredLine(line);
    return { ...line, fillers, arrangement: fillers.map((_, i) => i) };
  });
