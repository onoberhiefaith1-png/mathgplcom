import { describe, it, expect } from "vitest";
import { repairGeoRefText, derivePrincipleTitle, principleDuplicatesRelation, missingSquareHint, normalizeGeometrySource } from "../model";
import { geometryClassroomFallback } from "../renderStatement";

describe("geometry reference integrity", () => {
  it("repairs a subscript-damaged id", () => {
    expect(repairGeoRefText("\\georef{s_{C}A}{CA}^{2}", new Set(["s_CA"]))).toBe("\\georef{s_CA}{CA}^{2}");
  });
  it("keeps ids literal while normalising", () => {
    const out = normalizeGeometrySource("\\georef{s_CA}{CA}^{2}", (v) => v.replace(/_([A-Z])/g, "_{$1}"));
    expect(out).toContain("\\georef{s_CA}{CA}");
  });
  it("hides damaged georef in display", () => {
    expect(geometryClassroomFallback("\\georef{s_{C}A}{CA}^{2}")).toBe("CA²");
  });
  it("titles Pythagoras without repeating the equation", () => {
    const rel = "\\georef{s_CA}{CA}^{2}=\\georef{s_BC}{BC}^{2}+\\georef{s_AB}{AB}^{2}";
    expect(principleDuplicatesRelation(rel, rel)).toBe(true);
    expect(derivePrincipleTitle(rel)).toBe("Pythagoras' theorem");
  });
  it("warns about a missing square", () => {
    expect(missingSquareHint("\\georef{s_CA}{CA}=\\georef{s_BC}{BC}^{2}+\\georef{s_AB}{AB}^{2}")).toBe("Did you mean CA²?");
  });
});
