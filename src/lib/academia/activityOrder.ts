/** Pure ordering shared by connected Academia and downloaded Mathemagine. */
export type ActivityCategory = { kind?: string; adventure?: unknown; mcq?: unknown };
export function inActivityChain(row: ActivityCategory, mode: "practice" | "play"): boolean {
  if (row.kind === "adventure" || row.adventure) return false;
  return mode === "practice" || !(row.kind === "mcq" || row.mcq);
}
export type OrderedActivity = ActivityCategory & { id: string; assessment_id?: string | null; game_id?: string | null };
export function pickNeighbours<T extends OrderedActivity>(rows: T[], activityId: string, mode: "practice" | "play") {
  const usable = rows.filter(row => inActivityChain(row, mode) &&
    (mode === "play" ? !!row.game_id : row.kind === "mcq" || !!row.assessment_id));
  const index = usable.findIndex(row => row.id === activityId);
  return { prev: index > 0 ? usable[index - 1] : null,
    next: index >= 0 && index < usable.length - 1 ? usable[index + 1] : null,
    index, total: usable.length };
}
