import { describe, expect, it } from "vitest";

import { removeRedundantGeneratedPower } from "@/lib/lessonnotes/floatingCompile";
import {
  detectStructures,
  expandTransitionLine,
  hasEmptyPowerSlot,
  sanitizeFillers,
} from "@/lib/smartboard/floatingExtractor";

describe("Floating Number exponent structure", () => {
  it("keeps completed squares inside their values without a second power shell", () => {
    expect(sanitizeFillers(["(-3)^{2}", "4²"])) .toEqual({
      fillers: ["(-3)²", "4²"],
      structures: [],
    });
    expect(detectStructures("(-3)^{2} + 4²")).toEqual(["bracket"]);
  });

  it("does not break a newly completed square into base, exponent and power shell", () => {
    expect(expandTransitionLine(["4"], ["4²"])).toEqual({
      fillers: ["4²"],
      structures: [],
    });
  });

  it("preserves a true empty exponent slot as a power structure", () => {
    expect(hasEmptyPowerSlot("4^{□}")).toBe(true);
    expect(detectStructures("4^{□}")).toContain("power");
    expect(sanitizeFillers(["4^{□}"]).structures).toContain("power");
  });

  it("repairs only unedited generated lines that saved a redundant shell", () => {
    const generated = {
      lineId: "line-1",
      equation: "(-3)²",
      fillers: ["(-3)²"],
      containers: ["bracket", "power"] as const,
      containersSelected: [true, false],
      arrangement: [0],
    };
    const repaired = removeRedundantGeneratedPower({
      ...generated,
      containers: [...generated.containers],
    });
    expect(repaired.containers).toEqual(["bracket"]);
    expect(repaired.containersSelected).toEqual([true]);

    const teacherOwned = removeRedundantGeneratedPower({
      ...generated,
      containers: [...generated.containers],
      editedByTeacher: true,
    });
    expect(teacherOwned.containers).toEqual(["bracket", "power"]);
  });
});