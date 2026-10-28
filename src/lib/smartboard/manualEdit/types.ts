// Manual AI Edit — Live Mirror Mode target descriptors.
//
// Live Mirror Mode: the Presenter Preview is the source of truth, and
// clicking any preview object mirrors that object onto the Smartboard
// 1:1 using the same controller calls used during normal playback.
// If the mirror fails to appear, an automatic step-by-step rectify
// ladder (see autofix.ts) retries until it shows.

export type EditTargetKind =
  | "cover"
  | "section"
  | "subsection"
  | "question"
  | "solution-line"
  | "floating-number"
  | "teacher-note"
  | "math-structure";

export interface EditTarget {
  kind: EditTargetKind;
  beatId: string;
  caption: string;
  lineIdx?: number;
  fillerIdx?: number;
  text?: string;
  /** Index of this beat among beats of the SAME type ("-q" / "-text").
   *  Fallback matcher when section IDs have been regenerated and the
   *  preview's beatId no longer exists in the board's beat list. */
  beatOrdinal?: number;
}

/** Stable identity key for a target — used to route status badges. */
export const editTargetKey = (t: EditTarget): string =>
  [t.kind, t.beatId, t.lineIdx ?? "", t.fillerIdx ?? ""].join("|");

export type MirrorStatus = "idle" | "applying" | "ok" | "missing";

export interface MirrorResult {
  ok: boolean;
  /** Human-readable message shown next to the clicked item. */
  message: string;
  /** Optional diagnostic when ok === false. */
  detail?: string;
}

/** Live status shown as an inline badge on the clicked preview item. */
export interface MirrorUiStatus {
  /** editTargetKey of the item this status belongs to. */
  key: string;
  phase: "applying" | "fixing" | "ok" | "failed";
  /** Current autofix step (1-based) when phase === "fixing". */
  step?: number;
  totalSteps?: number;
  label: string;
  detail?: string;
}
