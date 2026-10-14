import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RELEASES, releasesFor } from "../releases";

describe("Academia download files", () => {
  it("Windows gets a Windows zip, never an APK", () => {
    const w = releasesFor("windows");
    expect(w).toHaveLength(1);
    expect(w[0].file.endsWith(".zip")).toBe(true);
    expect(w[0].file).toContain("win32");
  });
  it("Mac offers Apple chip and Intel builds", () => expect(releasesFor("mac").map((r) => r.file).sort()).toEqual(["MathGPL-Academia-darwin-arm64.zip", "MathGPL-Academia-darwin-x64.zip"]));
  it("the Android APK on the site really exists and matches its listed size", () => {
    const a = releasesFor("android")[0];
    expect(existsSync(`public${a.url}`)).toBe(true);
    expect(statSync(`public${a.url}`).size).toBe(a.bytes);
  });
  it("every listed file is non-empty", () => RELEASES.forEach((r) => expect(r.bytes).toBeGreaterThan(1_000_000)));
});
