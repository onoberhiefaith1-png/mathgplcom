import { describe, expect, it } from "vitest";
import { matchCommand, needsConfirm } from "../matcher";

const known = {
  classes: [{ id: "c1", name: "JSS2 Gold" }, { id: "c2", name: "SS1 Blue" }],
  notes: [{ id: "n1", name: "Quadratic Equations" }],
  games: [{ id: "g1", name: "Fraction Castle" }],
};

describe("Aura Lite matcher (no AI)", () => {
  it("creates a class by name and asks to confirm", () => {
    const c = matchCommand("Please create a class called JSS3 Red", known);
    expect(c).toEqual({ kind: "create_class", name: "JSS3 Red" });
    expect(needsConfirm(c)).toBe(true);
  });
  it("opens a named class with a typo", () => {
    expect(matchCommand("open my jss2 gld class", known)).toMatchObject({ kind: "open_class", classId: "c1" });
  });
  it("links a game to a class", () => {
    expect(matchCommand("add fraction castle to SS1 Blue", known)).toMatchObject({ kind: "link_game", gameId: "g1", classId: "c2" });
  });
  it("hands lesson-note writing to Copilot", () => {
    expect(matchCommand("make a lesson note on simultaneous equations", known)).toEqual({ kind: "make_note", topic: "simultaneous equations" });
  });
  it("navigates to Academia", () => {
    expect(matchCommand("go to academia", known)).toMatchObject({ kind: "navigate", path: "/school/academia" });
  });
  it("falls back to suggestions instead of AI", () => {
    expect(matchCommand("sing me a song about rivers", known).kind).toBe("unknown");
  });
});
