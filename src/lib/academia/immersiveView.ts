// Which Academia app screens take the whole screen. The bottom tab bar (Home,
// Learn, History, Evaluation, Schools) is not shown on them, and comes back when
// the student leaves.
type ActivityView = { k: "activity"; mode: "practice" | "play"; activity: { adventure?: unknown; game?: unknown; mcq?: unknown } };

export function isImmersiveView(view: { k: string } | ActivityView): boolean {
  if (view.k !== "activity") return false;
  const v = view as ActivityView;
  if (v.activity.mcq) return false;
  if (v.activity.adventure) return true;
  return v.mode === "play" && Boolean(v.activity.game);
}
