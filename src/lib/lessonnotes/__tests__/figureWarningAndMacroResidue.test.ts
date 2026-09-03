import { describe, expect, it } from "vitest";
import { analyzeProblem } from "@/lib/lessonnotes/problemDetect";
import { repairMangledMacros, recoverMacroResidue } from "@/lib/lessonnotes/macroRepair";
import { toUnicodeMath } from "@/lib/notebook/unicodeMath";

describe("Problem Check does not demand a figure for self-contained questions", () => {
  it("accepts 'Find the complementary angle of 67°'", () => {
    const r = analyzeProblem("Find the complementary angle of 67°");
    expect(r.status).toBe("valid");
    expect(r.issue).toBe("");
  });

  it("accepts a self-contained triangle question with its own numbers", () => {
    const r = analyzeProblem("Two angles of a triangle are 40° and 65°. Find the third angle.");
    expect(["valid"]).toContain(r.status);
  });

  it("still warns for a genuinely figure-dependent question", () => {
    const r = analyzeProblem("In the diagram below, find ∠ABC.");
    expect(r.status).toBe("uncertain");
    expect(r.issue).toMatch(/figure/i);
  });
});

describe("mangled macro residue is recovered", () => {
  it("restores a form-feed mangled \\frac", () => {
    expect(repairMangledMacros("\frac{3x}{3} = \frac{21}{3}")).toBe("\\frac{3x}{3} = \\frac{21}{3}");
  });

  it("restores a bare residue whose control character is gone", () => {
    expect(recoverMacroResidue("rac{3x}{3}")).toBe("\\frac{3x}{3}");
    expect(recoverMacroResidue("qrt{16}")).toBe("\\sqrt{16}");
  });

  it("never rewrites ordinary words", () => {
    expect(recoverMacroResidue("racing times ecology")).toBe("racing times ecology");
  });

  it("keeps a mangled fraction stacked through unicode conversion", () => {
    const out = toUnicodeMath("\frac{3x}{3} = 7");
    expect(out).toContain("\\frac{3x}{3}");
    expect(out).not.toMatch(/(?<![A-Za-z\\])rac3x3/);
  });
});
