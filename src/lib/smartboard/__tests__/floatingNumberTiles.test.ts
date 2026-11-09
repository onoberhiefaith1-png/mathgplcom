import { describe, expect, it } from "vitest";
import {
  CHIP_FIT_INSET,
  chipTrayStyle,
  fitContentScale,
  uniformTilePx,
  uniformTileStyle,
} from "../floatingNumberTiles";
import { GAME_CHIP_METRICS, floatingChipPx } from "../floatingNumberSize";

describe("uniform floating-number tiles", () => {
  it.each([0.85, 1, 1.3, 2])("keeps a square at scale %s", (scale) => {
    const style = uniformTileStyle(scale);
    const px = floatingChipPx(scale);
    expect(style.width).toBe(px);
    expect(style.height).toBe(px);
    expect(style.width).toBe(style.height);
    expect(style.maxWidth).toBe(px);
    expect(style.maxHeight).toBe(px);
    expect(style.fontSize).toBe(GAME_CHIP_METRICS.fontPx);
    expect(style.flex).toBe("0 0 auto");
    expect(uniformTilePx(scale)).toBe(px);
  });

  it("starts the tray at the first tile, without centering overflow", () => {
    const style = chipTrayStyle();
    expect(style.justifyContent).toBe("flex-start");
    expect(style.overflowX).toBe("auto");
    expect(style.overflowY).toBe("hidden");
  });

  it("shrinks oversized ink to the square and never enlarges small ink", () => {
    expect(fitContentScale(36, 36, 80, 90)).toBeCloseTo(36 / 90);
    expect(fitContentScale(36, 36, 12, 12)).toBe(1);
    expect(fitContentScale(0, 36, 12, 12)).toBe(1);
    expect(CHIP_FIT_INSET).toBeGreaterThan(0);
  });
});
