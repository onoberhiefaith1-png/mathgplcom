import type { CSSProperties } from "react";
import type { Slot } from "@/lib/slate/types";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { GameTextViewport, TextSettings } from "@/lib/slate/text3d";
import { FONTS } from "@/lib/slate/text3d";
import { normalizeTextConfig, textSettingsFromConfig } from "@/lib/slate/textConfig";
import { cssTextEffects, resolveTextStyle } from "@/lib/slate/textPresets";

export function gameFontFamily(settings: TextSettings): string {
  return `"MathGPL Game ${settings.style}", sans-serif`;
}

/** DOM presentation of the saved physical Game text. No independent offline theme. */
export function gameDomTextStyle(input: {
  gameText: TextSettings;
  slot: Slot;
  surface: SurfaceDef;
  viewport: GameTextViewport;
  sizePx: number;
  colourOverride?: string | null;
}): CSSProperties {
  const config = normalizeTextConfig(input.slot.textConfig, input.gameText);
  const settings = textSettingsFromConfig(input.gameText, config, input.viewport);
  const resolved = resolveTextStyle(input.surface, settings);
  return {
    color: input.colourOverride ?? settings.colour ?? resolved.face,
    fontFamily: gameFontFamily(settings),
    fontWeight: 400,
    letterSpacing: `${settings.letterSpacing}em`,
    lineHeight: settings.lineSpacing,
    opacity: settings.opacity,
    textAlign: settings.align,
    textShadow: cssTextEffects(resolved, input.sizePx) || undefined,
  };
}

/** Referenced by tests and offline tooling to keep all saved Game fonts available. */
export const GAME_FONT_URLS = [...new Set(Object.values(FONTS))];