import { describe, expect, it } from "vitest";
import {
  defaultTextConfig,
  normalizeTextConfig,
  savedTextOffset,
  textConfigFromPlacement,
  resolveSurfaceTextPlacement,
  configTextSize,
} from "../textConfig";
import { captureTextConfigs, fitTextToWritingSurface, restoreTextToSaved } from "../restoreText";
import { makeGame, makeSlot } from "../defaults";
import { normalizeGame } from "../storage";

const gameWithText = () => {
  const game = makeGame({
    name: "Text persistence",
    topic: "Algebra",
    subtopic: "Linear equations",
    surfaceId: "whiteboard",
    lines: 1,
    background: { src: null, kind: "image", scale: 1, x: 0, y: 0, opacity: 1 },
  });
  return { ...game, slots: [{ ...makeSlot(0), text: "x + 7 = 12" }] };
};

describe("saved text configuration", () => {
  it("discards every legacy horizontal position while preserving vertical placement", () => {
    const config = { ...defaultTextConfig(), ax: 0.25, ay: 0.2, align: "left" as const };
    const wide = savedTextOffset(config, 10, 4);
    const narrow = savedTextOffset(config, 5, 2);
    expect(wide.x).toBe(0);
    expect(narrow.x).toBe(0);
    expect(wide.y / 4).toBeCloseTo(narrow.y / 2);
  });

  it("keeps the teacher's placement across a save and reload", () => {
    const placed = textConfigFromPlacement(defaultTextConfig(), { x: 1.2, y: -0.6 }, 6, 3);
    const game = gameWithText();
    const saved = captureTextConfigs({
      ...game,
      slots: [{ ...game.slots[0]!, textConfig: placed }],
    });
    const reloaded = normalizeGame(JSON.parse(JSON.stringify(saved)));
    expect(reloaded.slots[0]?.textConfig?.ax).toBeCloseTo(placed.ax);
    expect(reloaded.slots[0]?.textConfig?.ay).toBeCloseTo(placed.ay);
  });

  it("restores a text whose placement was corrupted, without duplicating it", () => {
    const game = gameWithText();
    const master = captureTextConfigs(game);
    const broken = {
      ...master,
      slots: [{ ...master.slots[0]!, textConfig: { ...master.slots[0]!.textConfig!, ax: 9, ay: -4 } }],
    };
    const restored = restoreTextToSaved(broken);
    expect(restored.slots).toHaveLength(1);
    expect(restored.slots[0]?.id).toBe(game.slots[0]?.id);
    expect(restored.slots[0]?.text).toBe("x + 7 = 12");
    const config = restored.slots[0]!.textConfig!;
    expect(config.ax).toBeGreaterThanOrEqual(0);
    expect(config.ax).toBeLessThanOrEqual(1);
    expect(config.ay).toBeGreaterThanOrEqual(0);
    expect(config.ay).toBeLessThanOrEqual(1);
  });

  it("keeps a saved size for each device", () => {
    const config = normalizeTextConfig({ desktopSize: 40, tabletSize: 30, mobileSize: 20 });
    expect(configTextSize(config, "desktop")).toBe(40);
    expect(configTextSize(config, "tablet")).toBe(30);
    expect(configTextSize(config, "mobile")).toBe(20);
  });

  it("gives an older saved game a complete configuration instead of dropping its text", () => {
    const legacy = normalizeGame({ ...gameWithText(), slots: [{ id: "a", text: "y = 2" }] } as never);
    expect(legacy.slots[0]?.text).toBe("y = 2");
    expect(legacy.slots[0]?.textConfig).toBeTruthy();
  });

  it("fixes scattered text by keeping the words and applying the current text settings", () => {
    const game = gameWithText();
    const fixed = fitTextToWritingSurface({
      ...game,
      settings: {
        ...game.settings,
        text: {
          ...game.settings.text,
          desktopSize: 48,
          tabletSize: 34,
          mobileSize: 24,
          align: "left",
          lineSpacing: 1.8,
          letterSpacing: 0.05,
          colour: "#123456",
        },
      },
      slots: [{
        ...game.slots[0]!,
        text: "keep my writing",
        textConfig: {
          ...defaultTextConfig(),
          ax: 1,
          ay: 1,
          rotation: 32,
          desktopSize: 9,
          align: "right",
        },
      }],
    });
    expect(fixed.slots[0]?.text).toBe("keep my writing");
    expect(fixed.slots[0]?.textConfig?.ax).toBe(0);
    expect(fixed.slots[0]?.textConfig?.ay).toBe(0);
    expect(fixed.slots[0]?.textConfig?.rotation).toBe(0);
    expect(fixed.slots[0]?.textConfig?.desktopSize).toBe(48);
    expect(fixed.slots[0]?.textConfig?.tabletSize).toBe(34);
    expect(fixed.slots[0]?.textConfig?.mobileSize).toBe(24);
    expect(fixed.slots[0]?.textConfig?.align).toBe("left");
    expect(fixed.slots[0]?.textConfig?.lineSpacing).toBe(1.8);
    expect(fixed.slots[0]?.textConfig?.letterSpacing).toBe(0.05);
    expect(fixed.slots[0]?.textConfig?.colour).toBe("#123456");
  });

  it("keeps a valid measured placement unchanged", () => {
    const config = { ...defaultTextConfig(), align: "left" as const, ax: 0.2, ay: 0.1 };
    const result = resolveSurfaceTextPlacement({
      config,
      offset: { x: 1, y: -0.2 },
      body: { left: -1, right: 1, top: 0.4, bottom: -0.4 },
      inner: { left: -3, right: 3, top: 1, bottom: -1 },
      innerWidth: 6,
      innerHeight: 2,
    });
    expect(result.corrected).toBe(false);
    expect(result.config).toBe(config);
  });

  it("never turns a measured horizontal correction into saved indentation", () => {
    const config = { ...defaultTextConfig(), align: "left" as const, ax: 0, ay: 0 };
    const result = resolveSurfaceTextPlacement({
      config,
      offset: { x: 0, y: 0 },
      body: { left: -4, right: -1, top: 0.5, bottom: -0.5 },
      inner: { left: -3, right: 3, top: 1, bottom: -1 },
      innerWidth: 6,
      innerHeight: 2,
    });
    expect(result.corrected).toBe(false);
    expect(result.offset.x).toBe(0);
    expect(result.config.indent).toBe(0);
    expect(result.config.ax).toBe(0);
    expect(result.config.ay).toBe(0);
  });
});
