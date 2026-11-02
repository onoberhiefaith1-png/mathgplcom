/**
 * Light paper for the Quick Issue Tracker.
 *
 * The app shell is dark. The mathematics surfaces that stay light — the
 * Mathemagine desk (214 80% 97%), the Game cloud panel and royal plaque
 * (navy ink, gold edge), and the dashboard's white cards — share one
 * reading: white paper, navy type, a gold crest. These classes use those
 * existing tokens so the tracker does not invent a palette.
 */

/** Same desk colour as `.mm-app.mm-light`. */
export const DESK_COLOR = "hsl(214 80% 97%)";

/** Navy ink from `--dash-surface-foreground`. */
export const DESK_INK = "hsl(var(--dash-surface-foreground))";

const hint = "[--color-placeholder:hsl(224_16%_42%/0.72)]";

export const desk =
  `min-h-screen text-dash-surface-foreground antialiased [background-color:hsl(214_80%_97%)] [background-image:radial-gradient(1000px_500px_at_0%_-10%,hsl(205_95%_58%/0.18),transparent_60%),radial-gradient(800px_400px_at_100%_0%,hsl(var(--dash-gold)/0.16),transparent_60%)] ${hint}`;

export const paper =
  `overflow-hidden rounded-2xl border border-dash-border bg-dash-surface text-dash-surface-foreground shadow-[var(--shadow-dash)] ${hint}`;

/** Gold edge, the same accent as a Game royal frame and a dashboard stat. */
export const crest = "h-1 bg-dash-gold";

export const eyebrow =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-dash-surface-muted";

export const field =
  "min-h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 text-sm text-dash-surface-foreground outline-hidden transition placeholder:text-dash-surface-muted/70 focus:border-dash-gold focus-visible:ring-2 focus-visible:ring-dash-gold/40";

const focus =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dash-gold focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";

/** Phone-sized actions on the public tracker. Navy on white, as on light cards. */
export const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-dash-navy px-4 text-sm font-semibold text-dash-surface transition hover:opacity-90 disabled:opacity-50 ${focus}`;

export const quiet = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-dash-navy/15 bg-dash-surface px-4 text-sm font-medium text-dash-surface-foreground transition hover:bg-dash-navy/5 disabled:opacity-50 ${focus}`;

/** Staff Hub control size (rounded-lg, 38px) in the same light palette. */
export const hubPrimary =
  "inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg bg-dash-navy px-4 text-sm font-medium text-dash-surface transition hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dash-gold disabled:opacity-50";

export const hubQuiet =
  "inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border border-dash-border bg-dash-surface px-4 text-sm text-dash-surface-foreground transition hover:bg-dash-navy/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dash-gold disabled:opacity-50";

export const hubField =
  "w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-surface-foreground outline-hidden focus:border-dash-gold";
