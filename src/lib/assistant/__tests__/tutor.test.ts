import { describe, expect, it } from "vitest";
import { matchCommand, parseNoteRequest, pickSubtopic } from "../matcher";
import { deleteChip, mergeChips, moveChip, keepTogether } from "../floatingOps";
import { answerGuide, buildGuideScript, coachLine, guideQuestion, speakMath } from "../guide";
import { callTutorAction, registerTutorAction, waitForTutorAction } from "../actions";

const known = { classes: [{ id: "c1", name: "JSS2 Gold" }], notes: [], games: [] };

describe("Tutor: lesson notes through Copilot", () => {
  it("reads topic, subtopic and class from one sentence", () => {
    expect(parseNoteRequest("Create a lesson note on set notation, subtopic types of sets, for class JSS2 Gold"))
      .toEqual({ topic: "set notation", subtopic: "types of sets", className: "JSS2 Gold" });
  });
  it("keeps extra requests for Copilot", () => {
    expect(matchCommand("make a lesson note on sets with a Venn diagram example", known))
      .toMatchObject({ kind: "make_note", topic: "sets", extra: "a Venn diagram example" });
  });
  it("chooses a standard subtopic when the teacher says any", () => {
    expect(pickSubtopic("set notation")).toBe("Describing sets and set-builder notation");
    expect(pickSubtopic("Matrices")).toBe("Introduction to Matrices");
  });
  it("passes proceed and requests to Copilot", () => {
    expect(matchCommand("proceed", known)).toEqual({ kind: "proceed" });
    expect(matchCommand("tell copilot to add a harder example", known)).toEqual({ kind: "copilot_say", text: "add a harder example" });
  });
  it("sends section edits to AI Edit", () => {
    expect(matchCommand("make this example simpler", known)).toEqual({ kind: "ai_edit", instruction: "make this example simpler" });
  });
});

describe("Tutor: Floating Numbers by voice", () => {
  const line = { fillers: ["x", "+", "5", "=", "16"] };
  it("understands delete, merge and generate", () => {
    expect(matchCommand("delete floating number 5", known)).toEqual({ kind: "floating_delete", n: 5 });
    expect(matchCommand("merge floating numbers 1 to 3", known)).toEqual({ kind: "floating_merge", numbers: [1, 2, 3] });
    expect(matchCommand("generate floating numbers", known)).toEqual({ kind: "floating_generate" });
  });
  it("deletes, moves and merges by on-screen number", () => {
    expect(deleteChip(line, 5)?.fillers).toEqual(["x", "+", "5", "="]);
    expect(deleteChip(line, 9)).toBeNull();
    expect(moveChip(line, 5, 1)?.fillers).toEqual(["16", "x", "+", "5", "="]);
    expect(mergeChips(line, [1, 2, 3])?.fillers).toEqual(["x + 5", "=", "16"]);
  });
  it("keeps the equals sign and fraction together", () => {
    const l = { fillers: ["=", "x", "/", "2"] };
    expect(keepTogether(l, "=", "/")?.fillers).toEqual(["=", "/", "x", "2"]);
  });
});

describe("Tutor: Guide (offline, no AI)", () => {
  const lines = [
    { equation: "x + 5 = 16" },
    { equation: "x + 5 − 5 = 16 − 5", note: "Subtract 5 from both sides." },
    { equation: "x = 11" },
  ];
  const script = buildGuideScript(lines);
  it("speaks stored lines in order and never adds new ones", () => {
    expect(script.map((s) => s.equation)).toEqual(["x + 5 = 16", "x + 5 − 5 = 16 − 5", "x = 11"]);
    expect(speakMath("x + 5 = 16")).toBe("x plus 5 equals 16");
    expect(script[1]!.speech).toContain("Subtract 5 from both sides.");
  });
  it("answers why/next/answer from the stored solution", () => {
    expect(guideQuestion("why minus 5?")).toBe("why");
    expect(answerGuide(script, lines, 1, "why").speech).toBe("Subtract 5 from both sides.");
    expect(answerGuide(script, lines, 0, "next").step).toBe(1);
    expect(answerGuide(script, lines, 0, "answer").speech).toBe("The final line is x equals 11.");
  });
  it("coaches sign and arithmetic mistakes", () => {
    expect(coachLine("x = 11", "x = 11").kind).toBe("correct");
    expect(coachLine("x + 5 - 5 = 16 - 5", "x + 5 + 5 = 16 + 5").kind).toBe("sign");
    expect(coachLine("x = 11", "x = 21").kind).toBe("arithmetic");
  });
});

describe("Tutor action bus", () => {
  it("waits for a screen and calls its handler", async () => {
    const waiting = waitForTutorAction("test.ping", 500);
    const off = registerTutorAction("test.ping", () => ({ ok: true, say: "pong" }));
    expect(await waiting).toBe(true);
    expect(await callTutorAction("test.ping")).toEqual({ ok: true, say: "pong" });
    off();
    expect((await callTutorAction("test.ping")).ok).toBe(false);
  });
});
