import { describe, expect, it } from "vitest";
import { bootWatchdogScript, BOOT_WATCHDOG_MS } from "../bootWatchdog";

describe("Academia boot watchdog", () => {
  it("repairs at most once per tab and only online", () => {
    expect(bootWatchdogScript).toContain("aca-repair");
    expect(bootWatchdogScript).toContain("navigator.onLine");
  });
  it("never clears saved schools or results", () => {
    expect(bootWatchdogScript).not.toContain("indexedDB");
  });
  it("waits 8 seconds before repairing", () => expect(BOOT_WATCHDOG_MS).toBe(8000));
});
