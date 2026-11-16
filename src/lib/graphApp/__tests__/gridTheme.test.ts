import { describe, expect, it } from "vitest";
import { DEFAULT_GRID_THEME, resolveGridTheme } from "../gridTheme";

describe("resolveGridTheme", () => {
  it("keeps the current Math Lab colours when no theme is given", () => {
    const theme = resolveGridTheme(undefined);
    expect(theme).toEqual(DEFAULT_GRID_THEME);
    expect(theme.background).toBe("#ffffff");
    expect(theme.minor).toBe("rgba(15,23,42,0.06)");
    expect(theme.major).toBe("rgba(15,23,42,0.16)");
    expect(theme.axis).toBe("#0f172a");
    expect(theme.label).toBe("#334155");
  });

  it("returns a light-blue paper theme when asked", () => {
    const paper = resolveGridTheme("paper");
    expect(paper.id).toBe("paper");
    expect(paper.background).not.toBe(DEFAULT_GRID_THEME.background);
    expect(paper.majorWidth).toBeGreaterThan(paper.minorWidth);
  });
});
