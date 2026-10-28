import { inActivityChain, type ActivityCategory } from "./activityOrder";
/** One card stays one question; only Play-capable cards belong to the run. */
export function sessionPlaySequence<T extends ActivityCategory & { id: string }>(rows: T[], currentId: string, canPlay: (row: T) => boolean) {
  const playable = rows.filter(row => inActivityChain(row, "play") && canPlay(row));
  const index = playable.findIndex((row) => row.id === currentId);
  return { index, total: playable.length, next: index >= 0 ? playable[index + 1] ?? null : null };
}

export function sessionPlayFinal(status: "loading" | "ready" | "error", hasNext: boolean) {
  return status === "ready" && !hasNext;
}