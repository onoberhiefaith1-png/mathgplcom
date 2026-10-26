/**
 * Whether a downloaded Session activity can be opened, and if not, why.
 * Shared by the Session screen and the tests so the wording stays in one place.
 */
import { ACADEMIA_PACK_SCHEMA } from "@/lib/offline/academiaPack";
import type { PackActivity } from "@/lib/offline/academiaStore";

export const NOT_DOWNLOADED = "Not downloaded yet. Update to get this content";

export function isActivityReady(a: PackActivity): boolean {
  const offlineBoard = a.board ?? a.game?.board ?? null;
  return a.mcq ? a.mcq.questions.length > 0
    : a.adventure ? a.adventure.questions.length > 0 && !!a.adventure.game
    : offlineBoard ? true : a.lines.length > 1;
}

/** null when the activity is ready; otherwise the plain reason shown to the student. */
export function activityNotReadyReason(a: PackActivity, packSchema?: number): string | null {
  if (isActivityReady(a)) return null;
  // Downloads from before multiple choice / Adventure support have neither key, nor a kind.
  if ((packSchema ?? ACADEMIA_PACK_SCHEMA) < ACADEMIA_PACK_SCHEMA) return NOT_DOWNLOADED;
  if (a.kind === "mcq") {
    if (a.mcq === undefined) return NOT_DOWNLOADED;
    return "No questions assigned to this session yet";
  }
  if (a.kind === "adventure") {
    if (a.adventure === undefined) return NOT_DOWNLOADED;
    if (!a.adventure) return "This adventure isn't set up yet";
    if (!a.adventure.questions.length) return "No questions assigned to this adventure yet";
    return "No Game attached to this adventure yet";
  }
  return "No question yet";
}
