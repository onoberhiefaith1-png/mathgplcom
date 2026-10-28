// Join Live — which assessment (question board) is the student actually in?
//
// An assignment card is a SET of assessment rows (one per compiled question).
// Presence is tracked per assessment, so "In Progress" on the dashboard means
// the student is on SOME question board of the card. Opening the viewer on the
// card's first assessment is therefore wrong whenever the student is on any
// other question: the viewer would subscribe to a room nobody is in and hang
// on "waiting for the student's board".
//
// This resolver picks the assessment the student is genuinely present on.

export type PresenceByAssessment =
  | Record<string, string[] | Set<string>>
  | Map<string, Set<string> | string[]>;

const entries = (p: PresenceByAssessment): Array<[string, string[]]> => {
  const raw = p instanceof Map ? Array.from(p.entries()) : Object.entries(p);
  return raw.map(([k, v]) => [k, Array.isArray(v) ? v : Array.from(v)]);
};

/**
 * The assessment whose board the student currently has open, in the order the
 * card lists them. Falls back to `fallbackAssessmentId` when the student is not
 * present anywhere (offline / stale presence).
 */
export function resolveLiveAssessmentId(
  studentId: string,
  presence: PresenceByAssessment,
  orderedAssessmentIds: string[],
  fallbackAssessmentId: string | null = null,
): string | null {
  const map = new Map(entries(presence));
  for (const id of orderedAssessmentIds) {
    if ((map.get(id) ?? []).includes(studentId)) return id;
  }
  // Presence for an assessment outside the ordered list still beats nothing.
  for (const [id, users] of map) {
    if (users.includes(studentId)) return id;
  }
  return fallbackAssessmentId;
}
