import { describe, expect, it } from "vitest";
import { noteIdFromPath, screenPath, toCommand, type BrainPick } from "../appMap";

const known = { classes: [{ id: "c1", name: "JSS1" }], notes: [{ id: "n1", name: "Set notation" }], games: [] };
const base: BrainPick = { kind: "", reply: null, path: null, label: null, id: null, classId: null, topic: null, subtopic: null, className: null, extra: null, text: null, instruction: null, n: null, from: null, to: null, numbers: null, a: null, b: null };

describe("Talking MathGPL map", () => {
  it("rejects ids that are not in the user's workspace", () => {
    expect(toCommand({ ...base, kind: "open_note", id: "someone-else" }, known).command).toBeNull();
    expect(toCommand({ ...base, kind: "open_note", id: "n1" }, known).command).toEqual({ kind: "open_note", noteId: "n1", name: "Set notation" });
  });
  it("rejects pages that are not on the map", () => {
    expect(toCommand({ ...base, kind: "navigate", path: "/admin" }, known).command).toBeNull();
  });
  it("table edit requests become AI Edit on the named note", () => {
    const u = toCommand({ ...base, kind: "ai_edit", id: "n1", instruction: "add a Sum Row" }, known);
    expect(u.command).toEqual({ kind: "ai_edit", instruction: "add a Sum Row" });
    expect(u.noteId).toBe("n1");
  });
  it("opens the note screen itself when a note is known", () => {
    expect(screenPath("note", { noteId: "n1" })).toBe("/lesson-notes/n1");
    expect(screenPath("note", { noteId: null })).toBeNull();
    expect(noteIdFromPath("/lesson-notes/12345678-1234-1234-1234-123456789abc")).toBe("12345678-1234-1234-1234-123456789abc");
  });
});
