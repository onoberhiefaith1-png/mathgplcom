import { describe, expect, it } from "vitest";
import { uniqueLineId } from "@/lib/assessments/createAssessment";

describe("uniqueLineId (per-question line/key identity)", () => {
  it("keeps first ids unchanged so existing keys stay valid", () => {
    const used = new Set<string>();
    expect(uniqueLineId(used, "hl_a")).toBe("hl_a");
    expect(uniqueLineId(used, "hl_b")).toBe("hl_b");
  });
  it("disambiguates a repeated id deterministically so key lookup cannot pick the wrong line", () => {
    const used = new Set<string>();
    const ids = ["hl_legacy_2_x", "hl_legacy_2_x", "hl_legacy_2_x"].map((i) => uniqueLineId(used, i));
    expect(ids).toEqual(["hl_legacy_2_x", "hl_legacy_2_x~2", "hl_legacy_2_x~3"]);
    expect(new Set(ids).size).toBe(3);
  });
});
