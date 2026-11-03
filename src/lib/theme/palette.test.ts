import { describe, expect, it } from "vitest";
import { APP_THEME_KEY, WELCOME_THEME_KEY } from "./appearance";
import {
  APP_PALETTE_KEY,
  WELCOME_PALETTE_KEY,
  parseColorTheme,
  readColorTheme,
  writeColorTheme,
} from "./palette";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("color themes", () => {
  it("defaults to Ocean and Gold and ignores unknown values", () => {
    const storage = memory();
    expect(readColorTheme(storage, "welcome")).toBe("ocean-and-gold");
    expect(readColorTheme(storage, "app")).toBe("ocean-and-gold");
    expect(parseColorTheme(null)).toBe("ocean-and-gold");
    expect(parseColorTheme("forest-night")).toBe("ocean-and-gold");
  });

  it("stores welcome and app palettes apart from light/dark", () => {
    const storage = memory();
    storage.setItem(WELCOME_THEME_KEY, "light");
    storage.setItem(APP_THEME_KEY, "dark");
    writeColorTheme(storage, "welcome", "sunset-coral");
    writeColorTheme(storage, "app", "forest-mint");
    expect(storage.getItem(WELCOME_PALETTE_KEY)).toBe("sunset-coral");
    expect(storage.getItem(APP_PALETTE_KEY)).toBe("forest-mint");
    expect(storage.getItem(WELCOME_THEME_KEY)).toBe("light");
    expect(storage.getItem(APP_THEME_KEY)).toBe("dark");
    expect(readColorTheme(storage, "welcome")).toBe("sunset-coral");
    expect(readColorTheme(storage, "app")).toBe("forest-mint");
  });
});
