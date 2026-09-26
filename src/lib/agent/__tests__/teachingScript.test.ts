import { describe, expect, it } from "vitest";

import { buildTeachingScript, parseTeachingScript, MAX_TEACHING_STEPS } from "../teachingScript";

describe("the lesson Aura performs out loud", () => {
  it("pairs each spoken step with the board line it belongs to", () => {
    const script = buildTeachingScript(
      ["Our question is x plus five equals twelve.", "Subtract five from both sides."],
      [1, 2],
      "Simple equation",
    );
    expect(script.title).toBe("Simple equation");
    expect(script.steps).toEqual([
      { say: "Our question is x plus five equals twelve.", line: 1 },
      { say: "Subtract five from both sides.", line: 2 },
    ]);
  });

  it("treats a missing or zero line as an aside that moves no line", () => {
    const script = buildTeachingScript(["Watch the sign here."], [0], "");
    expect(script.steps[0]?.line).toBeNull();
    expect(script.title).toBe("Lesson");
  });

  it("refuses an empty lesson and one longer than a taught sequence", () => {
    expect(() => buildTeachingScript([], [], "")).toThrow();
    expect(() => buildTeachingScript(["   "], [], "")).toThrow();
    expect(() =>
      buildTeachingScript(Array.from({ length: MAX_TEACHING_STEPS + 1 }, () => "Step."), [], ""),
    ).toThrow();
  });

  it("reads a lesson back off a result, and nothing else", () => {
    const script = buildTeachingScript(["One.", "Two."], [1, 2], "Test");
    expect(parseTeachingScript(JSON.parse(JSON.stringify(script)))).toEqual(script);
    expect(parseTeachingScript({ ok: true })).toBeNull();
    expect(parseTeachingScript(null)).toBeNull();
  });
});
