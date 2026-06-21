// Verifies the deterministic backend pipeline preserves BOTH sides of an
// equation highlight (the screenshot bug: chips were starting after "=").
import { describe, it, expect } from "vitest";
import { extractLine } from "../../supabase/functions/notebook-ai/floatingExtractor.ts";
import { verifyCompleteness } from "../../supabase/functions/notebook-ai/completenessVerifier.ts";

describe("floating_highlights — completeness preserves left-hand side", () => {
  it("partial-fraction setup keeps the LHS chips before =", () => {
    const payload = "(x²+4)/((x+1)²(x−2)) = A/(x+1) + B/(x+1)² + C/(x−2)";
    const out = extractLine(payload);
    // The "=" splitter chip must exist AND must not be the first chip.
    const eqIdx = out.fillers.indexOf("=");
    expect(eqIdx).toBeGreaterThan(0);
    // Every salient identifier from the source must be reachable in the chips.
    const comp = verifyCompleteness(payload, out.fillers.join(" "));
    // All right-side identifiers and left-side numerator/denominator must appear.
    expect(comp.missingIdentifiers).toEqual([]);
    expect(comp.missingNumbers).toEqual([]);
  });

  it("Let-prefixed partial-fraction line keeps everything", () => {
    const payload = "Let (x²+4)/((x+1)²(x−2)) = A/(x+1) + B/(x+1)² + C/(x−2)";
    const out = extractLine(payload);
    expect(out.fillers.length).toBeGreaterThan(4);
    expect(out.fillers).toContain("=");
  });
});
