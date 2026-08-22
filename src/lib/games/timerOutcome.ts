// The one place that decides what happens when the Timer reaches zero.
//
// The Timer measures time only. The Progress Bar measures score only. The
// outcome is the intersection of the two, resolved here so gameplay, the
// editor's Start Test preview and any future report all agree.
import type { ProgressConfig } from "./types";

export type TimerOutcome = "running" | "success" | "failure";

export interface TimerOutcomeInput {
  /** true once the countdown has hit zero. */
  expired: boolean;
  /** true when the required score was reached in time. */
  goalReached: boolean;
}

export const DEFAULT_FAILURE_MESSAGE = "Time is up — the required score was not reached.";

export const resolveTimerOutcome = ({ expired, goalReached }: TimerOutcomeInput): TimerOutcome => {
  if (goalReached) return "success";
  if (expired) return "failure";
  return "running";
};

/** Teacher-authored failure message, or the platform default. */
export const failureMessageOf = (progress: ProgressConfig | null | undefined): string => {
  const text = progress?.failureMessage?.trim();
  return text && text.length > 0 ? text : DEFAULT_FAILURE_MESSAGE;
};

/** Whether a failure ending should play the authored outro video. */
export const playsOutro = (progress: ProgressConfig | null | undefined): boolean =>
  (progress?.timerDisplay ?? null) === "video" && Boolean(progress?.timerVideo?.storagePath);
