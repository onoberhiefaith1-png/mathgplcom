import { describe, expect, it } from "vitest";
import {
  defaultTextConfig,
  normalizeTextConfig,
  savedTextOffset,
  textConfigFromPlacement,
  configTextSize,
} from "../textConfig";
import { captureTextConfigs, restoreTextToSaved } from "../restoreText";
import { defaultGame, makeSlot } from "../defaults";
import { normalizeGame } from "../storage";

const gameWithText = () => {
  const game = defaultGame();
  return { ...game, slots: [{ ...makeSlot(0), text: "x + 7 = 12" }] };
};

describe("saved text configuration", () => {
  it("describes a text as a share of its own writing surface, never screen pixels", () => {
    const config = { ...defaultTextConfig(), ax: 0.25, ay: 0.2, align: "left" as const };
    const wide = savedTextOffset(config, 10, 4);
    const narrow = savedTextOffset(config, 5, 2);
    expect(wide.x / 10).toBeCloseTo(narrow.x / 5);
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
});
