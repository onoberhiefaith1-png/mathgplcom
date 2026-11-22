import { describe, expect, it } from "vitest";
import { questionForPracticeCard } from "../../practiceEntry";

const first = { id: "first", text: "Question 1", lines: [{ id: "left" }] };
const second = { id: "second", text: "Question 2", lines: [{ id: "right" }] };

describe("Academia Practice card scope", () => {
  it("selects only the linked question within an older multi-question assessment", () => {
    expect(questionForPracticeCard([first, second], "second")).toEqual(second);
    expect(questionForPracticeCard([first, second], "first")).toEqual(first);
  });

  it("does not fall back to another question for a mismatched source", () => {
    expect(questionForPracticeCard([first, second], "removed")).toBeUndefined();
    expect(questionForPracticeCard([first], "removed")).toBeUndefined();
  });

  it("opens a single legacy question without a source but rejects ambiguous cards", () => {
    expect(questionForPracticeCard([first], null)).toEqual(first);
    expect(questionForPracticeCard([first, second], null)).toBeUndefined();
  });
});
