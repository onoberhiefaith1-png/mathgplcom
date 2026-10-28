import { describe, expect, it } from "vitest";
import { AWAIT_MS, AwaitingSlot, isFollowUp } from "../followUp";
import { describeApp } from "../appMap";
import { publishScreen, registerTutorAction, screenSummary } from "../actions";

describe("Tutor: follow-ups continue the waiting request", () => {
  it("treats 'I have opened it' and 'done' as carry on", () => {
    expect(isFollowUp("i have open it")).toBe(true);
    expect(isFollowUp("I've opened it")).toBe(true);
    expect(isFollowUp("done")).toBe(true);
    expect(isFollowUp("create a lesson note on sets")).toBe(false);
  });
  it("runs the waiting guide request exactly once", () => {
    const slot = new AwaitingSlot();
    slot.set("guide.start", {}, 0);
    expect(slot.take(10)?.name).toBe("guide.start");
    expect(slot.take(20)).toBeNull();
  });
  it("forgets the waiting request after two minutes", () => {
    const slot = new AwaitingSlot();
    slot.set("guide.start", {}, 0);
    expect(slot.peek(AWAIT_MS + 1)).toBeNull();
  });
});

describe("Tutor: knows what is on screen", () => {
  it("puts the open question and ready actions in the map", () => {
    const off = publishScreen({ page: "question", question: "Solve for p. 2p − 3 = 9", hasSolution: true });
    const offA = registerTutorAction("guide.start", () => ({ ok: true }));
    const map = describeApp({ classes: [], notes: [], games: [] }, "/academia/practice/x/y", screenSummary());
    expect(map).toContain("question open: Solve for p. 2p − 3 = 9");
    expect(map).toContain("guide.start");
    offA(); off();
  });
  it("reports a question without a saved solution", () => {
    const off = publishScreen({ page: "question", question: "Q", hasSolution: false });
    expect(screenSummary().hasSolution).toBe(false);
    expect(describeApp({ classes: [], notes: [], games: [] }, "/", screenSummary())).toContain("saved solution: no");
    off();
    expect(screenSummary().page).toBe("other");
  });
});
