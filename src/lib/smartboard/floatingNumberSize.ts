/**
 * Floating Number Size (next-edition spec §8–§10). A presentation-only scale
 * for the floating-number strip on the Smart Board and the phone surface.
 *
 * 1 = the size the GAME uses (spec §8: "make the game's current floating-number
 * size the default"). The Smart Board and the Game both draw their chips from
 * {@link GAME_CHIP_METRICS}, so at scale 1 a board chip and a game chip are the
 * same size. The scale is applied as a CSS `zoom` on the strip, so controls,
 * numbers and the space between them grow together.
 *
 * Maximum: a scaled chip may be at most ONE THIRD OF THE SCREEN. "Screen" is the
 * browser viewport's smaller side, min(innerWidth, innerHeight), so the cap
 * holds in portrait and landscape alike:
 *   maxScale = (min(innerWidth, innerHeight) / 3) / GAME_CHIP_METRICS.minPx
 *
 * Floating Number Display designs are untouched — this only scales them.
 */

/** The game's floating-number chip — the single size authority for chips. */
export const GAME_CHIP_METRICS = {
  /** Chip min width/height (px). The chip's visual size at scale 1. */
  minPx: 40,
  padding: "2px 6px",
  /** Space between neighbouring chips (px). */
  gapPx: 6,
  /** Number glyph size (px) — the game strip's `text-lg`. */
  fontPx: 18,
} as const;

export const FLOATING_SIZE_DEFAULT = 1;
export const FLOATING_SIZE_MIN = 0.7;
/** The +/− ladder. The top step on any screen is the one-third-of-screen cap itself. */
export const FLOATING_SIZE_STEPS = [
  0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 12,
] as const;
/** Sanity bound for stored values (bigger than any real screen's cap). */
const ABSOLUTE_MAX = 24;
export const FLOATING_SIZE_STORAGE_KEY = "mathgpl.floatingNumberSize";
const EVENT = "mathgpl:floating-number-size";
const EPS = 1e-6;

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Largest scale for this screen: a chip may be at most one third of
 * min(viewport width, viewport height). Never below the default size.
 */
export function maxFloatingSizeFor(
  viewportWidth: number | null | undefined,
  viewportHeight?: number | null,
): number {
  const w = Number(viewportWidth);
  const h = viewportHeight == null ? w : Number(viewportHeight);
  const sides = [w, h].filter((n) => Number.isFinite(n) && n > 0);
  if (sides.length === 0) return 2;
  const third = Math.min(...sides) / 3;
  return round(
    Math.max(
      FLOATING_SIZE_DEFAULT,
      Math.min(ABSOLUTE_MAX, third / GAME_CHIP_METRICS.minPx),
    ),
  );
}

/** Rendered chip size (px) at a scale — what the one-third cap is measured on. */
export const floatingChipPx = (scale: number) =>
  GAME_CHIP_METRICS.minPx * scale;

/** Keep any stored value inside [min, max]. Garbage falls back to the default. */
export function clampFloatingSize(
  value: unknown,
  max: number = ABSOLUTE_MAX,
): number {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n) || n <= 0)
    return FLOATING_SIZE_DEFAULT;
  return round(
    Math.min(Math.max(n, FLOATING_SIZE_MIN), Math.max(FLOATING_SIZE_MIN, max)),
  );
}

/** One step bigger (+1) or smaller (-1) on the ladder, never past the ends or the screen cap. */
export function stepFloatingSize(
  current: unknown,
  dir: -1 | 1,
  max: number = ABSOLUTE_MAX,
): number {
  const cap = Math.max(FLOATING_SIZE_MIN, max);
  const now = clampFloatingSize(current, cap);
  // The ladder on this screen: every step below the cap, then the cap itself.
  const ladder: number[] = [
    ...FLOATING_SIZE_STEPS.filter((s) => s < cap - EPS),
    round(cap),
  ];
  if (dir > 0) return ladder.find((s) => s > now + EPS) ?? now;
  for (let i = ladder.length - 1; i >= 0; i--)
    if (ladder[i] < now - EPS) return ladder[i];
  return now;
}

export const floatingSizeLabel = (scale: number) =>
  `${Math.round(scale * 100)}%`;

export function readFloatingSize(): number {
  if (typeof window === "undefined") return FLOATING_SIZE_DEFAULT;
  try {
    const raw = window.localStorage.getItem(FLOATING_SIZE_STORAGE_KEY);
    return raw == null ? FLOATING_SIZE_DEFAULT : clampFloatingSize(raw);
  } catch {
    return FLOATING_SIZE_DEFAULT;
  }
}

export function writeFloatingSize(scale: number) {
  if (typeof window === "undefined") return;
  const v = clampFloatingSize(scale);
  try {
    window.localStorage.setItem(FLOATING_SIZE_STORAGE_KEY, String(v));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
}

export function subscribeFloatingSize(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (e.key === FLOATING_SIZE_STORAGE_KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
