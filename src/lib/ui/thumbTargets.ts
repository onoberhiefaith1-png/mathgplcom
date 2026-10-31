/**
 * Thumb-friendly hit targets (next-edition spec §5). The upgraded game
 * controls use a 56px minimum (floating display `Tri` buttons); practice
 * controls on phones now meet the same bar. Dense phone rows that must fit
 * seven controls across a 360px screen use 48px, the smallest size that is
 * still comfortable for a thumb. Laptop keeps denser controls.
 */
export const GAME_THUMB_PX = 56;
export const PRACTICE_ROW_THUMB_PX = 48;

/** Icon button in a dense phone practice row (48px, 40px on md+ screens). */
export const PRACTICE_ROW_BUTTON = "grid h-12 w-12 shrink-0 place-items-center rounded-lg md:h-10 md:w-10";
/** Stand-alone phone practice button (56px tall, like the game controls). */
export const PRACTICE_THUMB_BUTTON = "inline-flex min-h-14 min-w-14 items-center justify-center gap-1.5 rounded-xl px-4 text-base font-semibold md:min-h-10 md:min-w-10 md:px-3 md:text-sm";
