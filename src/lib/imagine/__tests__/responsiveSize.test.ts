import { describe, expect, it } from "vitest";
import {
  IMAGINE_TEXT_MIN,
  imagineSavedSize,
  imagineSliderToSize,
  imagineSizeToSlider,
  imagineSurfaceScale,
} from "../responsiveSize";

describe("Imagine responsive text size", () => {
  it("puts each former minimum at the exact slider midpoint", () => {
    expect(imagineSliderToSize(50, "desktop")).toBe(16);
    expect(imagineSliderToSize(50, "tablet")).toBe(16);
    expect(imagineSliderToSize(50, "phone")).toBe(14);
    expect(imagineSizeToSlider(16, "desktop")).toBe(50);
    expect(imagineSizeToSlider(14, "phone")).toBe(50);
  });

  it("reaches the near-invisible true minimum", () => {
    expect(imagineSliderToSize(0, "desktop")).toBe(IMAGINE_TEXT_MIN);
    expect(imagineSliderToSize(0, "phone")).toBe(IMAGINE_TEXT_MIN);
  });

  it("keeps all three saved device sizes independent", () => {
    const settings = {
      sensorVisible: true,
      growWithContent: true,
      finish: "framed" as const,
      textTreatment: "raised" as const,
      desktopTextSize: 48,
      tabletTextSize: 24,
      mobileTextSize: 7,
    };
    expect(imagineSavedSize(settings, "desktop", 30)).toBe(48);
    expect(imagineSavedSize(settings, "tablet", 30)).toBe(24);
    expect(imagineSavedSize(settings, "phone", 30)).toBe(7);
  });

  it("preserves legacy activities through their existing device value", () => {
    expect(imagineSavedSize(undefined, "phone", 22)).toBe(22);
  });

  it("contracts the surface below the former minimum", () => {
    expect(imagineSurfaceScale(14, "phone")).toBe(1);
    expect(imagineSurfaceScale(7, "phone")).toBe(0.5);
    expect(imagineSurfaceScale(1, "phone")).toBeCloseTo(1 / 14);
  });
});