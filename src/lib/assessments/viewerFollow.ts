// Teacher assessment viewer — which question the teacher's board shows.
//
// Two modes, one resolver:
//   live  — the board tracks the student. The instant signal is the student's
//           own Smartboard broadcast (`assessment-live-*` carries questionId
//           on every frame). The persisted board row is only a fallback for an
//           offline student, because it exists only AFTER a debounced write —
//           a question the student just opened has no row yet.
//   work  — the teacher reads saved work and picks the question. The live
//           signal is ignored so the view never jumps mid-review.

export type ViewerMode = "live" | "work";

export type FollowInputs = {
  mode: ViewerMode;
  /** ?q= in the URL (an explicit deep link to one question). */
  explicitQuestionId?: string | null;
  /** questionId from the student's live board broadcast. */
  liveQuestionId?: string | null;
  /** questionId the student reports through presence the moment a question
   *  board opens — available before the first board frame arrives. */
  presenceQuestionId?: string | null;
  /** Question the teacher selected in the question strip (work mode). */
  pickedQuestionId?: string | null;
  /** Most recently persisted question board row (slow fallback). */
  lastPersistedQuestionId?: string | null;
  /** First question of the assessment — last resort. */
  firstQuestionId?: string | null;
};

export function resolveViewerQuestionId(i: FollowInputs): string | null {
  const first = i.firstQuestionId ?? null;
  if (i.mode === "live") {
    // LIVE IS STUDENT-DRIVEN ONLY. The persisted row is the LAST question
    // written to the database, which is routinely a different question from
    // the one the student is on — it must never decide a live view.
    return i.liveQuestionId ?? i.presenceQuestionId ?? null;
  }
  return i.pickedQuestionId ?? i.explicitQuestionId ?? i.lastPersistedQuestionId ?? first;
}


/** A deep link to one question opens in review mode; otherwise follow a
 *  student who is on the board right now. */
export function initialViewerMode(o: {
  explicitQuestionId?: string | null;
  requestedMode?: string | null;
  online?: boolean;
}): ViewerMode {
  if (o.requestedMode === "live") return "live";
  if (o.requestedMode === "work") return "work";
  if (o.explicitQuestionId) return "work";
  return o.online ? "live" : "work";
}
