/** One card stays one question; only Play-capable cards belong to the run. */
export function sessionPlaySequence<T extends { id: string }>(rows: T[], currentId: string, canPlay: (row: T) => boolean) {
  const playable = rows.filter(canPlay);
  const index = playable.findIndex((row) => row.id === currentId);
  return { index, total: playable.length, next: index >= 0 ? playable[index + 1] ?? null : null };
}

export function sessionPlayFinal(status: "loading" | "ready" | "error", hasNext: boolean) {
  return status === "ready" && !hasNext;
}