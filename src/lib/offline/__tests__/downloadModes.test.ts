import { describe, expect, it } from "vitest";
import { DEVICES } from "@/components/site/DownloadAcademiaDialog";

const byId = (id: string) => DEVICES.find((d) => d.id === id)!;

describe("Download Academia modes", () => {
  it("offers Copy to phone on Android, iPhone, Windows and Mac", () => {
    expect(DEVICES.filter((d) => d.copy.length > 0).map((d) => d.id)).toEqual(["android", "ios", "windows", "mac"]);
  });
  it("offers app files only for Android, Windows and Mac, never iPhone", () => {
    expect(DEVICES.filter((d) => d.download.length > 0).map((d) => d.id)).toEqual(["android", "windows", "mac"]);
    expect(byId("ios").download).toEqual([]);
  });
});
