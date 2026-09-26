import { describe, expect, it } from "vitest";

import { looksLikeWork, parseFastTurn, repairVocabulary } from "../meaning";

describe("repairVocabulary", () => {
  it("repairs the words the microphone keeps mangling", () => {
    expect(repairVocabulary("put the flooding numbers on the smart board")).toBe(
      "put the floating numbers on the smartboard",
    );
    expect(repairVocabulary("open my lesson notes")).toBe("open my lesson note");
  });

  it("leaves a clean sentence alone", () => {
    expect(repairVocabulary("create a class called Grade 9")).toBe("create a class called Grade 9");
  });
});

describe("looksLikeWork", () => {
  it("knows real work from small talk", () => {
    expect(looksLikeWork("create a lesson note on quadratic equations")).toBe(true);
    expect(looksLikeWork("solve two x plus five equals eleven")).toBe(true);
    expect(looksLikeWork("hello, are you there")).toBe(false);
    expect(looksLikeWork("yes please")).toBe(false);
  });
});

describe("parseFastTurn", () => {
  it("reads the fast brain's answer", () => {
    const turn = parseFastTurn(
      '{"meaning":"open the lesson note","reply":"Sure, opening it now.","deep":true}',
      "um open the the lesson note",
    );
    expect(turn).toEqual({
      meaning: "open the lesson note",
      reply: "Sure, opening it now.",
      deep: true,
    });
  });

  it("falls back to the repaired transcript when the answer is unusable", () => {
    const turn = parseFastTurn("sorry, no idea", "create a lesson notes");
    expect(turn.meaning).toBe("create a lesson note");
    expect(turn.reply).toBe("");
    expect(turn.deep).toBe(true);
  });

  it("does not send small talk to the deep worker", () => {
    expect(parseFastTurn("", "hello there").deep).toBe(false);
  });
});

describe("questions about real workspace things", () => {
  it("sends a question about their classes to the worker that can look", () => {
    expect(looksLikeWork("tell me what classes I have")).toBe(true);
    expect(looksLikeWork("how many students are in Grade 9")).toBe(true);
  });

  it("overrides the fast brain when it wrongly calls real work small talk", () => {
    const parsed = parseFastTurn(
      '{"meaning":"Tell me what classes I have.","reply":"I can help with that!","deep":false}',
      "tell me what classes I the the have",
    );
    expect(parsed.deep).toBe(true);
  });

  it("still answers a greeting without the worker", () => {
    expect(looksLikeWork("hello Aura, are you with me")).toBe(false);
    expect(looksLikeWork("thanks, that's great")).toBe(false);
  });
});
