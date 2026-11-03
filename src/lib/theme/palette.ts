/**
 * Color themes sit beside light/dark and never share those keys.
 * Welcome and the signed-in app stay independent, same as appearance.
 * Swatches match the Mathemagine palettes in AcademiaApp (ocean, sunset, forest).
 */

export const WELCOME_PALETTE_KEY = "mathgpl.palette.welcome";
export const APP_PALETTE_KEY = "mathgpl.palette.app";

export type ColorTheme = "ocean-and-gold" | "sunset-coral" | "forest-mint";
export type ColorThemeScope = "welcome" | "app";

export const COLOR_THEME_KEY: Record<ColorThemeScope, string> = {
  welcome: WELCOME_PALETTE_KEY,
  app: APP_PALETTE_KEY,
};

export const COLOR_THEMES: { id: ColorTheme; label: string; swatch: string }[] = [
  { id: "ocean-and-gold", label: "Ocean and Gold", swatch: "linear-gradient(90deg,#1e4fd8,#fbbf24)" },
  { id: "sunset-coral", label: "Sunset Coral", swatch: "linear-gradient(90deg,#e8475f,#ff9f43)" },
  { id: "forest-mint", label: "Forest Mint", swatch: "linear-gradient(90deg,#0f766e,#a3e635)" },
];

const IDS = new Set<string>(COLOR_THEMES.map((theme) => theme.id));

export function parseColorTheme(value: string | null | undefined): ColorTheme {
  return value && IDS.has(value) ? (value as ColorTheme) : "ocean-and-gold";
}

export function readColorTheme(
  storage: Pick<Storage, "getItem"> | null | undefined,
  scope: ColorThemeScope,
): ColorTheme {
  if (!storage) return "ocean-and-gold";
  try {
    return parseColorTheme(storage.getItem(COLOR_THEME_KEY[scope]));
  } catch {
    return "ocean-and-gold";
  }
}

export function writeColorTheme(
  storage: Pick<Storage, "setItem">,
  scope: ColorThemeScope,
  value: ColorTheme,
) {
  storage.setItem(COLOR_THEME_KEY[scope], value);
}
