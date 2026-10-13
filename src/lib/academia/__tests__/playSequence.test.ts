import { describe, expect, it } from "vitest";
import { sessionPlaySequence, sessionPlayFinal } from "../playSequence";

const rows = ["1", "practice-only", "2", "3", "4"].map(id => ({ id, game: id !== "practice-only" }));
describe("Session Play progression", () => {
  it("continues all four Play questions in order, skipping Practice", () => {
    expect(["1", "2", "3", "4"].map(id => sessionPlaySequence(rows, id, r => r.game).next?.id ?? "Finish"))
      .toEqual(["2", "3", "4", "Finish"]);
  });
  it("counts playable questions only", () => {
    expect(sessionPlaySequence(rows, "3", r => r.game)).toMatchObject({ index: 2, total: 4 });
  });
  it("never calls a loading or failed Session lookup final", () => {
    expect(sessionPlayFinal("loading", false)).toBe(false);
    expect(sessionPlayFinal("error", false)).toBe(false);
    expect(sessionPlayFinal("ready", true)).toBe(false);
    expect(sessionPlayFinal("ready", false)).toBe(true);
  });
});