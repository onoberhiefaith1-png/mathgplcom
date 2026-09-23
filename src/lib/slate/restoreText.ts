/* ── Save and Restore of the teacher's text configuration ─────────────────
 *
 * Save: the teacher's exact text — words, place on its own surface, size for
 * each device, alignment, colour, spacing, rotation — becomes the MASTER
 * record of that writing surface's text.
 *
 * Restore: the existing text object is put back to that master record. No
 * duplicate is created, nothing is recreated, and the teacher never has to
 * reposition or resize anything.
 */

import { defaultTextSettings } from "./text3d";
import { defaultTextConfig, normalizeTextConfig } from "./textConfig";
import type { SlotTextConfig } from "./textConfig";
import type { Game, Slot, TextSettings } from "./types";

const globalText = (game: Game): TextSettings => ({
  ...defaultTextSettings(),
  ...(game.settings?.text ?? {}),
});

/**
 * Called when the teacher saves. Every surface ends up with a complete master
 * record, and the shared look chosen in the text panel is written into it, so
 * what is on screen at Save is exactly what everyone sees afterwards.
 */
export const captureTextConfigs = (game: Game): Game => {
  const settings = globalText(game);
  const shared = defaultTextConfig(settings);
  return {
    ...game,
    slots: game.slots.map((slot) => {
      const saved = normalizeTextConfig(slot.textConfig, settings);
      const textConfig: SlotTextConfig = {
        ...saved,
        // The panel owns the shared look; the surface owns the placement.
        desktopSize: shared.desktopSize,
        tabletSize: shared.tabletSize,
        mobileSize: shared.mobileSize,
        align: shared.align,
        colour: shared.colour,
        lineSpacing: shared.lineSpacing,
        letterSpacing: shared.letterSpacing,
        ax: slot.textConfig ? saved.ax : shared.ax,
        ay: slot.textConfig ? saved.ay : shared.ay,
      };
      return { ...slot, textConfig } satisfies Slot;
    }),
  };
};

/**
 * Restore. Forces every text on every writing surface back to its saved master
 * record: same words, same place, same size, same formatting, inside the
 * surface. Repeatable, and reliable every time.
 */
export const restoreTextToSaved = (game: Game): Game => {
  const settings = globalText(game);
  return {
    ...game,
    slots: game.slots.map((slot) => ({
      ...slot,
      textConfig: normalizeTextConfig(slot.textConfig, settings),
    })),
  };
};

/**
 * Text fix. This is deliberately NOT a reset of the Game run or of the words.
 * It re-attaches the current writing to each physical writing surface and
 * reapplies the Game's current text settings, so scattered text comes back onto
 * the material without changing the exercise, rewards, marks or progress.
 */
export const fitTextToWritingSurface = (game: Game): Game => {
  const settings = globalText(game);
  const shared = defaultTextConfig(settings);
  return {
    ...game,
    slots: game.slots.map((slot) => {
      const saved = normalizeTextConfig(slot.textConfig, settings);
      const textConfig: SlotTextConfig = {
        ...saved,
        widthFrac: 1,
        heightFrac: 1,
        desktopSize: shared.desktopSize,
        tabletSize: shared.tabletSize,
        mobileSize: shared.mobileSize,
        align: shared.align,
        rotation: 0,
        colour: shared.colour,
        lineSpacing: shared.lineSpacing,
        letterSpacing: shared.letterSpacing,
        ax: shared.ax,
        ay: shared.ay,
      };
      return { ...slot, textConfig } satisfies Slot;
    }),
  };
};
