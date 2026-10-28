import { describe, it, expect } from "vitest";
import { colourMarks } from "@/lib/geometry/map/renderTokens";
import { geometryClassroomSource } from "@/lib/geometry/map/renderStatement";

describe("geometry property formulas stay whole", () => {
  const v = "\\tan\\angle BAC = \\frac{\\georef{s1}{BC}}{\\georef{s2}{AB}}";
  it("keeps the fraction in one piece with the side names inside it", () => {
    expect(geometryClassroomSource(v)).toContain("\\frac{BC}{AB}");
  });
  it("colours each side by its object", () => {
    const marks = colourMarks(v, [], (id) => (id === "s1" ? "#00f" : "#f00"));
    expect(marks).toEqual(expect.arrayContaining([{ token: "BC", color: "#00f" }, { token: "AB", color: "#f00" }]));
  });
});
