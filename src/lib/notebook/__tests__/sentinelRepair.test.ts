// A power must never vanish because a converter marker leaked into the text.
// Regression cover for stored floating chips such as `xPOWERSCRIPT₀LOT`,
// which is what an empty power slot (`x^{□}`) degraded into.

import { describe, expect, it } from "vitest";
import { hasLeakedSentinel, repairLeakedSentinels } from "@/lib/notebook/sentinelRepair";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import { mirrorLessonNoteRow } from "@/lib/smartboard/mirrorFromLessonNote";
import type { Node } from "@/lib/smartboard/mathTree";

const supOf = (src: string) => {
  const row = mirrorLessonNoteRow(src).row;
  const node = row.find((n) => n.kind === "subsup") as Extract<Node, { kind: "subsup" }>;
  return node?.rows?.[2] ?? [];
};

describe("leaked sentinel repair", () => {
  it("restores the mangled empty-power marker", () => {
    expect(repairLeakedSentinels("xPOWERSCRIPT₀LOT")).toBe("x^{□}");
    expect(repairLeakedSentinels("xPOWER_SLOT")).toBe("x^{□}");
    expect(repairLeakedSentinels("x\uE000POWER_SLOT\uE000")).toBe("x^{□}");
  });

  it("restores a leaked held script as a writable exponent", () => {
    expect(repairLeakedSentinels("aSCRIPT_0")).toBe("a^{□}");
    expect(repairLeakedSentinels("a\uE001SCRIPT_12\uE001")).toBe("a^{□}");
  });

  it("never leaves a private-use marker in the text", () => {
    expect(repairLeakedSentinels("a\uE000b")).toBe("ab");
    expect(hasLeakedSentinel("2x²")).toBe(false);
  });

  it("leaves ordinary classroom math untouched", () => {
    for (const src of ["2x²", "x^{2}", "√(9)", "H₂O", "\\frac{a}{b}"]) {
      expect(repairLeakedSentinels(src)).toBe(src);
    }
  });

  it("brings the power back through the shared display gate", () => {
    expect(assertDisplaySafe("xPOWERSCRIPT₀LOT").cleaned).toContain("^{");
  });

  it("mirrors the repaired chip onto the board as a real power", () => {
    expect(supOf("xPOWERSCRIPT₀LOT")).toHaveLength(1);
    expect(supOf("2x²")).toHaveLength(1);
  });
});
