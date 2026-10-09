import { describe, expect, it } from "vitest";
import { pickRestoredBoard } from "../useAssessmentBoardSession";

describe("reopening a half-finished board", () => {
  it("continues from unsaved work left on the device", () => {
    const r = pickRestoredBoard({ ts: 1 }, { snap: { ts: 5 }, synced: false });
    expect(r.state?.ts).toBe(5);
    expect(r.resync).toBe(true);
  });
  it("uses the saved copy when the device has nothing newer", () => {
    expect(pickRestoredBoard({ ts: 9 }, { snap: { ts: 5 }, synced: true }).state?.ts).toBe(9);
  });
  it("does not bring work back after a Reset cleared the saved copy", () => {
    expect(pickRestoredBoard(null, { snap: { ts: 5 }, synced: true }).state).toBeNull();
  });
});
