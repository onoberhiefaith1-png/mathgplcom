import { describe, expect, it } from "vitest";
import { isImmersiveView } from "../immersiveView";

const activity = (over: Record<string, unknown>) => ({ k: "activity" as const, mode: "practice" as const, activity: over });
describe("isImmersiveView", () => {
  it("hides the tab bar for an Adventure", () => {
    expect(isImmersiveView(activity({ adventure: { id: "a" } }))).toBe(true);
  });
  it("hides it for a Game-based activity played as a Game", () => {
    expect(isImmersiveView({ ...activity({ game: { game: {} } }), mode: "play" })).toBe(true);
  });
  it("keeps it for practice on the board, a Paper, and every other screen", () => {
    expect(isImmersiveView(activity({ game: {} }))).toBe(false);
    expect(isImmersiveView({ ...activity({ mcq: {}, game: {} }), mode: "play" })).toBe(false);
    for (const k of ["home", "school", "session", "history", "evaluation", "schools", "papers", "paper", "review", "results"]) expect(isImmersiveView({ k })).toBe(false);
  });
  it("brings it back when the student leaves (the view is no longer an activity)", () => {
    let view: { k: string } = activity({ adventure: {} });
    expect(isImmersiveView(view)).toBe(true);
    view = { k: "session" };
    expect(isImmersiveView(view)).toBe(false);
  });
});
