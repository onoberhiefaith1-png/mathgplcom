/** Pure ordering helper for Academia activity chains (testable, no network). */
export type OrderedActivity = { id: string; assessment_id?: string | null; game_id?: string | null };

export function pickNeighbours<T extends OrderedActivity>(rows: T[], activityId: string, mode: "practice" | "play") {
  const usable = rows.filter((row) => (mode === "play" ? !!row.game_id : !!row.assessment_id));
  const index = usable.findIndex((row) => row.id === activityId);
  return {
    prev: index > 0 ? usable[index - 1] : null,
    next: index >= 0 && index < usable.length - 1 ? usable[index + 1] : null,
    index,
    total: usable.length,
  };
}
