import { describe, expect, it } from "vitest";
import { defaultTextSettings, responsiveTextSize } from "../text3d";

describe("responsive Game text size", () => {
  it("selects the independent size for each viewport", () => {
    const settings = {
      ...defaultTextSettings(),
      size: 30,
      desktopSize: 84,
      tabletSize: 58,
      mobileSize: 36,
    };

    expect(responsiveTextSize(settings, "desktop")).toBe(84);
    expect(responsiveTextSize(settings, "tablet")).toBe(58);
    expect(responsiveTextSize(settings, "mobile")).toBe(36);
  });

  it("uses the legacy shared size when responsive values are absent", () => {
    const settings = {
      ...defaultTextSettings(),
      size: 72,
      desktopSize: undefined,
      tabletSize: undefined,
      mobileSize: undefined,
    };

    expect(responsiveTextSize(settings, "desktop")).toBe(72);
    expect(responsiveTextSize(settings, "tablet")).toBe(72);
    expect(responsiveTextSize(settings, "mobile")).toBe(72);
  });

  it("does not alter any shared text appearance setting", () => {
    const settings = {
      ...defaultTextSettings(),
      colour: "#123456",
      depth: 1.7,
      style: "dimensional" as const,
      desktopSize: 90,
      tabletSize: 60,
      mobileSize: 32,
    };

    const rendered = { ...settings, size: responsiveTextSize(settings, "mobile") };
    expect(rendered.size).toBe(32);
    expect(rendered.colour).toBe(settings.colour);
    expect(rendered.depth).toBe(settings.depth);
    expect(rendered.style).toBe(settings.style);
  });
});