import { describe, expect, it } from "vitest";
import { tryEvaluate, evaluate } from "@/components/lessonnotes/extensions/visuals/smarttable/evaluator";

describe("shared in-cell calculator", () => {
  it.each([
    ["(-5)^{2}", "25"], ["(-2)^{2}", "4"], ["(-5)²", "25"],
    ["[−5]^{2}", "25"], ["4−9", "-5"], ["11−9", "2"],
    ["\\frac{9}{4}", "2.25"], ["\\sqrt{25}", "5"], ["√9", "3"],
    ["2^{-2}", "0.25"], ["-5^2", "-25"], ["=5", "5"],
  ])("evaluates the saved maths %s", (source, expected) => {
    expect(tryEvaluate(source)).toBe(expected);
  });
  it.each(["(□)^{2}", "x-9", "\\sqrt{-1}", "3/0", "alert(1)"])("leaves incomplete or nonnumeric maths %s untouched", source => {
    expect(tryEvaluate(source)).toBeNull();
  });
});
