import { describe, expect, it } from "vitest";
import { defaultSettings, makeSlot } from "@/lib/slate/defaults";
import { getSurface } from "@/lib/slate/surfaces";
import { gameDomTextStyle, gameFontFamily } from "../domTextStyle";

describe("Game DOM writing fidelity", () => {
  it("uses the saved per-surface font, preset effects and opacity", () => {
    const settings = defaultSettings().text;
    const slot = makeSlot(0);
    const config = slot.textConfig;
    if (!config) throw new Error("makeSlot must create text settings");
    slot.textConfig = {
      ...config,
      style: "handwritten",
      preset: "neon",
      colour: "#123456",
      opacity: 0.72,
      shadow: true,
      glow: "medium",
    };
    const style = gameDomTextStyle({
      gameText: settings,
      slot,
      surface: getSurface("plain"),
      viewport: "mobile",
      sizePx: 30,
    });
    expect(style.fontFamily).toBe('"MathGPL Game handwritten", sans-serif');
    expect(style.color).toBe("#123456");
    expect(style.opacity).toBe(0.72);
    expect(style.textShadow).toContain("rgba");
  });

  it("gives saved writing styles different local font families", () => {
    expect(gameFontFamily({ ...defaultSettings().text, style: "chalk" })).not.toBe(
      gameFontFamily({ ...defaultSettings().text, style: "technical" }),
    );
  });
});