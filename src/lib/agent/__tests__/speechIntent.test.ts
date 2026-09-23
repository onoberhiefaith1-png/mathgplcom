import { describe, expect, it } from "vitest";

import { cleanSpokenText, looksMisheard } from "../speechIntent";

describe("cleanSpokenText", () => {
  it("turns a hesitant sentence into the intended instruction", () => {
    const heard =
      "Um... I want... I want you to, you know, open the lesson note and, um, work on quadratic equations...";
    expect(cleanSpokenText(heard)).toBe(
      "I want you to open the lesson note and work on quadratic equations",
    );
  });

  it("collapses immediate word repeats", () => {
    expect(cleanSpokenText("open the the note")).toBe("open the note");
  });

  it("drops non-English scraps but keeps the English words", () => {
    expect(cleanSpokenText("open 你好 the note")).toBe("open the note");
  });

  it("leaves a clean sentence alone", () => {
    expect(cleanSpokenText("Create a class called Grade 9 Mathematics.")).toBe(
      "Create a class called Grade 9 Mathematics.",
    );
  });

  it("returns nothing for filler on its own", () => {
    expect(cleanSpokenText("um")).toBe("");
    expect(cleanSpokenText("   ")).toBe("");
  });

  it("keeps real short words", () => {
    expect(cleanSpokenText("go to my notes")).toBe("go to my notes");
  });
});

describe("looksMisheard", () => {
  it("flags a slice that is mostly another script", () => {
    expect(looksMisheard("你好世界")).toBe(true);
    expect(looksMisheard("안녕하세요")).toBe(true);
  });

  it("accepts ordinary English", () => {
    expect(looksMisheard("open the lesson note")).toBe(false);
    expect(looksMisheard("")).toBe(false);
  });
});
