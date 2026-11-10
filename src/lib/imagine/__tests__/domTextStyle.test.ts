import { describe, expect, it } from "vitest";
import { defaultSettings, makeSlot } from "@/lib/slate/defaults";
import { getSurface } from "@/lib/slate/surfaces";
import { gameDomTextStyle, gameFontFamily, gameWritingColour } from "../domTextStyle";

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

  it("uses the same ink as a normal Game line, not surface ink or near-black", () => {
    const gameText = defaultSettings().text;
    const slot = makeSlot(0);
    const surface = getSurface("stone-tablet");
    const line = gameDomTextStyle({
      gameText,
      slot,
      surface,
      viewport: "mobile",
      sizePx: 30,
    });
    const tableInk = gameWritingColour({ gameText, slot, surface, viewport: "mobile" });
    expect(tableInk).toBe(String(line.color));
    expect(tableInk.toLowerCase()).not.toBe("#1a2230");
    expect(tableInk.toLowerCase()).not.toBe(surface.ink.toLowerCase());
    // Default Game settings use the royal-blue writing face, the usual line colour.
    expect(tableInk.toLowerCase()).toMatch(/^#?[0-9a-f]{6}$/);
    const hex = tableInk.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    expect(b).toBeGreaterThan(r);
    expect(gameWritingColour({ gameText, colourOverride: "#1e4fa3" })).toBe("#1e4fa3");
  });
});
