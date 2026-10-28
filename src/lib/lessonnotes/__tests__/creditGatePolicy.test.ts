import { describe, expect, it } from "vitest";
import {
  modeOf,
  requiresCreditGate,
} from "../../../../supabase/functions/_shared/gatePolicy";

describe("credit gate policy (notebook-ai)", () => {
  it("does not gate the deterministic floating modes", () => {
    expect(
      requiresCreditGate("notebook-ai", {
        mode: "floating_highlights",
        highlights: [],
      }),
    ).toBe(false);
    expect(requiresCreditGate("notebook-ai", { mode: "floating" })).toBe(false);
  });

  it("gates floating_line_edit only when it will call the model (an instruction was typed)", () => {
    expect(
      requiresCreditGate("notebook-ai", {
        mode: "floating_line_edit",
        equation: "x=1",
      }),
    ).toBe(false);
    expect(
      requiresCreditGate("notebook-ai", {
        mode: "floating_line_edit",
        equation: "x=1",
        instruction: "   ",
      }),
    ).toBe(false);
    expect(
      requiresCreditGate("notebook-ai", {
        mode: "floating_line_edit",
        equation: "x=1",
        instruction: "split the bracket",
      }),
    ).toBe(true);
  });

  it("keeps every AI mode gated", () => {
    for (const mode of [
      "generate",
      "solve_with_reasoning",
      "mathengine",
      "copilot",
      "edit",
      "geometry",
      "blueprint",
      "review",
      "verify",
      "scan",
      "table_edit",
    ]) {
      expect(requiresCreditGate("notebook-ai", { mode })).toBe(true);
    }
  });

  it("fails closed: unknown, missing or malformed input stays gated", () => {
    expect(requiresCreditGate("notebook-ai", { mode: "something_new" })).toBe(
      true,
    );
    expect(requiresCreditGate("notebook-ai", {})).toBe(true);
    expect(requiresCreditGate("notebook-ai", null)).toBe(true);
    expect(requiresCreditGate("notebook-ai", "floating_highlights")).toBe(true);
    expect(
      requiresCreditGate("notebook-ai", { mode: ["floating_highlights"] }),
    ).toBe(true);
  });

  it("only exempts modes of the function that owns them", () => {
    expect(
      requiresCreditGate("some-other-fn", { mode: "floating_highlights" }),
    ).toBe(true);
    expect(
      requiresCreditGate("some-other-fn", { mode: "floating_line_edit" }),
    ).toBe(true);
  });

  it("modeOf reads only string modes", () => {
    expect(modeOf({ mode: "edit" })).toBe("edit");
    expect(modeOf({ mode: 3 })).toBeNull();
    expect(modeOf(undefined)).toBeNull();
  });
});
