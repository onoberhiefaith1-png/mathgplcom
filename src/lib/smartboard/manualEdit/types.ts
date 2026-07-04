// Manual AI Edit — target descriptors, operator events, and reports.

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

export type EditIntent =
  | "sync-note"
  | "sync-floating"
  | "sync-line"
  | "sync-highlight"
  | "sync-structure"
  | "fix-spacing"
  | "fix-overlap"
  | "fix-order"
  | "fix-active-line"
  | "fix-scroll"
  | "move-note"
  | "rerender-structure"
  | "unknown";

export type RootCause =
  | "click-not-fired"
  | "panel-did-not-open"
  | "chip-not-registered"
  | "render-empty"
  | "sync-lost"
  | "mapping-missing"
  | "wrong-layer"
  | "blocked-by-overlap"
  | "outside-viewport"
  | "queue-missed"
  | "active-line-drift"
  | "structural"
  | "none";

export type OperatorPhase =
  | "diagnose"
  | "reproduce"
  | "observe"
  | "root-cause"
  | "repair"
  | "verify"
  | "report";

export interface OperatorEvent {
  phase: OperatorPhase;
  label: string;
  ok: boolean;
  detail?: string;
  tookMs?: number;
}

export interface EditAction {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface EditReport {
  ok: boolean;
  intent: EditIntent;
  rootCause?: RootCause;
  message: string;
  actions: EditAction[];
  events: OperatorEvent[];
  escalate?: {
    reason: string;
    trail: OperatorEvent[];
  };
}
