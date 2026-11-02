import { describe, expect, it } from "vitest";
import {
  APP_THEME_KEY,
  WELCOME_THEME_KEY,
  nextAppearance,
  parseAppearance,
  readAppearance,
  writeAppearance,
} from "./appearance";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("appearance preferences", () => {
  it("defaults each scope to dark and ignores unknown values", () => {
    const storage = memory();
    expect(readAppearance(storage, "welcome")).toBe("dark");
    expect(readAppearance(storage, "app")).toBe("dark");
    expect(parseAppearance("paper")).toBe("dark");
    expect(parseAppearance(null)).toBe("dark");
  });

  it("stores welcome and app themes under separate keys", () => {
    const storage = memory();
    writeAppearance(storage, "welcome", "light");
    writeAppearance(storage, "app", "dark");
    expect(storage.getItem(WELCOME_THEME_KEY)).toBe("light");
    expect(storage.getItem(APP_THEME_KEY)).toBe("dark");
    expect(readAppearance(storage, "welcome")).toBe("light");
    expect(readAppearance(storage, "app")).toBe("dark");

    writeAppearance(storage, "app", "light");
    expect(readAppearance(storage, "welcome")).toBe("light");
    expect(readAppearance(storage, "app")).toBe("light");
  });

  it("flips one way at a time", () => {
    expect(nextAppearance("dark")).toBe("light");
    expect(nextAppearance("light")).toBe("dark");
  });
});
