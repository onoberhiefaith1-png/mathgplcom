// Manual AI Edit — Live Mirror Mode target descriptors.
//
// Live Mirror Mode replaces the previous diagnose/repair operator: the
// Presenter Preview is the source of truth, and clicking any preview
// object mirrors that object onto the Smartboard 1:1 using the same
// controller calls used during normal playback.

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
}

export type MirrorStatus = "idle" | "applying" | "ok" | "missing";

export interface MirrorResult {
  ok: boolean;
  /** Human-readable message shown in the status strip. */
  message: string;
  /** Optional diagnostic when ok === false. */
  detail?: string;
}
