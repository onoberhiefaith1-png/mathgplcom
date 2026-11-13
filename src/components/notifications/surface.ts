/**
 * Notification ink is locked to the card surface.
 *
 * The default dark theme keeps a white popover (`--popover`) while page text
 * (`--foreground`, `--muted-foreground`) is cream meant for the night canvas.
 * Painting those colours inside the bell, or filling a row with `--accent`,
 * drops the copy below readable contrast. These classes always pair
 * `bg-card` / `bg-muted` with `text-card-foreground`.
 */
export const notificationPanelClass =
  "border-border bg-card text-card-foreground shadow-lg";

export const notificationTitleClass =
  "block text-sm font-semibold leading-5 text-card-foreground";

export const notificationBodyClass =
  "block text-sm leading-5 text-card-foreground";

export const notificationMessageClass =
  "mt-2 whitespace-pre-wrap text-base leading-7 text-card-foreground";

export const notificationMetaClass =
  "text-xs font-medium leading-4 text-muted-foreground";
