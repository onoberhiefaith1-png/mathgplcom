/** Per-device appearance. The public welcome shell and the signed-in app never share a key. */

export const WELCOME_THEME_KEY = "mathgpl.theme.welcome";
export const APP_THEME_KEY = "mathgpl.theme.app";

export type Appearance = "light" | "dark";
export type AppearanceScope = "welcome" | "app";

export const APPEARANCE_KEY: Record<AppearanceScope, string> = {
  welcome: WELCOME_THEME_KEY,
  app: APP_THEME_KEY,
};

export function parseAppearance(value: string | null | undefined): Appearance {
  return value === "light" ? "light" : "dark";
}

export function readAppearance(storage: Pick<Storage, "getItem"> | null | undefined, scope: AppearanceScope): Appearance {
  if (!storage) return "dark";
  try {
    return parseAppearance(storage.getItem(APPEARANCE_KEY[scope]));
  } catch {
    return "dark";
  }
}

export function writeAppearance(storage: Pick<Storage, "setItem">, scope: AppearanceScope, value: Appearance) {
  storage.setItem(APPEARANCE_KEY[scope], value);
}

export function nextAppearance(current: Appearance): Appearance {
  return current === "dark" ? "light" : "dark";
}
