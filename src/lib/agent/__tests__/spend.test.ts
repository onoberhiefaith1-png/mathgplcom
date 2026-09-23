import { describe, expect, it } from "vitest";

import { formatPence, turnCost, describeSpend, DAILY_PENCE_CEILING, spendCeilingReached } from "../spend";

describe("turnCost", () => {
  it("prices an ordinary turn on the everyday brain in a fraction of a penny", () => {
    const cost = turnCost("openai/gpt-5-nano", 4000, 300);
    expect(cost.input).toBe(4000);
    expect(cost.output).toBe(300);
    expect(cost.pence).toBeGreaterThan(0);
    expect(cost.pence).toBeLessThan(0.05);
  });

  it("prices the heavy reasoning engine far higher for the same turn", () => {
    const cheap = turnCost("openai/gpt-5-nano", 4000, 300).pence;
    const heavy = turnCost("openai/gpt-6-astra", 4000, 300).pence;
    expect(heavy).toBeGreaterThan(cheap * 20);
  });

  it("never reports a negative cost", () => {
    expect(turnCost("openai/gpt-5-nano", -10, -10).pence).toBe(0);
  });
});

describe("formatPence", () => {
  it("keeps tiny amounts readable instead of rounding to nothing", () => {
    expect(formatPence(0.004)).toBe("<0.01p");
    expect(formatPence(0.42)).toBe("0.42p");
    expect(formatPence(12.5)).toBe("12.5p");
    expect(formatPence(250)).toBe("£2.50");
  });
});

describe("describeSpend", () => {
  it("shows today's figure in plain words", () => {
    expect(describeSpend({ day: "2026-09-23", pence: 0.6, turns: 4 })).toContain("4 turns");
  });

  it("says plainly when the day's allowance is used up", () => {
    const spend = { day: "2026-09-23", pence: DAILY_PENCE_CEILING, turns: 900 };
    expect(spendCeilingReached(spend)).toBe(true);
    expect(describeSpend(spend)).toContain("used up");
  });
});
