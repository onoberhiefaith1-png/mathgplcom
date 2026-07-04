// Manual AI Edit — target descriptors used by the Presenter Preview
// selection layer and the AI Workspace drawer.
//
// The Presenter Preview panel tags every renderable unit with a
// `data-edit-target` attribute carrying a JSON-serialised EditTarget.
// The drawer receives the parsed object and passes it to the dispatcher
// (see ./dispatch.ts).

export type EditTargetKind =
  | "cover"
  | "section" // prose section: introduction/explanation/summary
  | "subsection" // whole example/exercise/classwork/homework card
  | "question" // the problem statement inside a subsection
  | "solution-line" // one reservoir line row
  | "floating-number" // one filler chip inside a line
  | "teacher-note" // the NoteBlock inside a line
  | "math-structure"; // an inline math span (coarse)

export interface EditTarget {
  kind: EditTargetKind;
  /** Beat id of the enclosing item (e.g. "__cover__", "<secId>-text",
   *  "<subId>-q"). Always present so the dispatcher can address the beat. */
  beatId: string;
  /** Human-readable caption for the drawer header. */
  caption: string;
  /** Solution line index (0-based) when kind is line-scoped. */
  lineIdx?: number;
  /** Filler chip index within the line when kind === "floating-number". */
  fillerIdx?: number;
  /** Renderable text snapshot — equation for lines, note text, chip text… */
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

export interface EditAction {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface EditReport {
  ok: boolean;
  intent: EditIntent;
  message: string;
  actions: EditAction[];
}
