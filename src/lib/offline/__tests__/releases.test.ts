import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RELEASES, releasesFor } from "../releases";

describe("Academia download files", () => {
  it("Windows gets one Mathemagine .exe installer, never a zip or APK", () => {
    const w = releasesFor("windows");
    expect(w).toHaveLength(1);
    expect(w[0].file).toMatch(/^Mathemagine-Setup-.*\.exe$/);
  });
  it("iPhone/iPad gets no download file", () => expect(releasesFor("ios")).toHaveLength(0));
  it("Mac offers Apple chip and Intel builds", () => expect(releasesFor("mac").map((r) => r.file).sort()).toEqual(["Mathemagine-mac-arm64-1.0.1.zip", "Mathemagine-mac-x64-1.0.1.zip"]));
  it("the Android APK on the site really exists and matches its listed size", () => {
    const a = releasesFor("android")[0];
    expect(existsSync(`public${a.url}`)).toBe(true);
    expect(statSync(`public${a.url}`).size).toBe(a.bytes);
  });
  it("every listed file is non-empty", () => RELEASES.forEach((r) => expect(r.bytes).toBeGreaterThan(1_000_000)));
});
