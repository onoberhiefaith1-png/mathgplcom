import { describe, expect, it } from "vitest";
import { workLineMarks } from "../authoredFloatingLines";

describe("workLineMarks", () => {
  it("keeps a positive authored mark", () => {
    expect(workLineMarks(2)).toBe(2);
    expect(workLineMarks("3")).toBe(3);
  });
  it("defaults missing or zero marks so solved work lines can award a score", () => {
    expect(workLineMarks(0)).toBe(1);
    expect(workLineMarks(undefined)).toBe(1);
    expect(workLineMarks(null)).toBe(1);
    expect(workLineMarks("")).toBe(1);
  });
});
