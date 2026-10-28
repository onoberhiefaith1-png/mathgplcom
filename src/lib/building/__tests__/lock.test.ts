import { describe, expect, it } from "vitest";
import { keypadRows, retryLabel, validateCodePair } from "../lock";

describe("room lock", () => {
  it("offers a numeric keypad only", () => {
    const keys = keypadRows("alphanumeric").flat();
    expect(keys).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]);
  });

  it("requires the code twice", () => {
    expect(validateCodePair("4729", "4729", "digits", 4)).toBeNull();
    expect(validateCodePair("4729", "4728", "digits", 4)).toMatch(/do not match/);
  });

  it("says the retry wait in plain English", () => {
    expect(retryLabel(5)).toBe("5 minutes");
    expect(retryLabel(60)).toBe("1 hour");
    expect(retryLabel(1440)).toBe("24 hours");
    expect(retryLabel(4320)).toBe("3 days");
  });
});

describe("remaining wait", () => {
  it("counts down from the moment the wait ends", async () => {
    const { remainingWaitLabel } = await import("../lock");
    const in3h = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    expect(remainingWaitLabel(in3h, 1440)).toBe("3 hours");
    expect(remainingWaitLabel(new Date(Date.now() - 1000).toISOString(), 1440)).toBeNull();
    expect(remainingWaitLabel(null, 1440)).toBe("24 hours");
    expect(remainingWaitLabel(null, null)).toBeNull();
  });
});
