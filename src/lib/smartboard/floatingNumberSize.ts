/**
 * Floating Number Size (next-edition spec §8–§10). A presentation-only scale
 * for the floating-number strip on the Smart Board and the phone surface.
 * 1 = the size the game uses today (the default). Steps go smaller and larger;
 * the largest step is capped by the screen so the strip always fits.
 * Floating Number Display designs are untouched — this only scales them.
 */
export const FLOATING_SIZE_DEFAULT = 1;
export const FLOATING_SIZE_STEPS = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5] as const;
export const FLOATING_SIZE_STORAGE_KEY = "mathgpl.floatingNumberSize";
const EVENT = "mathgpl:floating-number-size";

/** Largest scale that still fits this screen width ("as large as the screen allows"). */
export function maxFloatingSizeFor(viewportWidth: number | null | undefined): number {
  const w = Number(viewportWidth);
  if (!Number.isFinite(w) || w <= 0) return 2;
  if (w < 400) return 1.3;
  if (w < 768) return 1.5;
  if (w < 1280) return 2;
  return 2.5;
}

/** Snap any stored value to a real step within [min step, max]. */
export function clampFloatingSize(value: unknown, max: number = FLOATING_SIZE_STEPS[FLOATING_SIZE_STEPS.length - 1]): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return FLOATING_SIZE_DEFAULT;
  const allowed = FLOATING_SIZE_STEPS.filter((s) => s <= max + 1e-9);
  let best: number = allowed[0] ?? FLOATING_SIZE_DEFAULT;
  for (const s of allowed) if (Math.abs(s - n) < Math.abs(best - n)) best = s;
  return best;
}

/** One step bigger (+1) or smaller (-1), never past the ends or the screen cap. */
export function stepFloatingSize(current: unknown, dir: -1 | 1, max?: number): number {
  const cap: number = max ?? FLOATING_SIZE_STEPS[FLOATING_SIZE_STEPS.length - 1];
  const now = clampFloatingSize(current, cap);
  const allowed = FLOATING_SIZE_STEPS.filter((s) => s <= cap + 1e-9);
  const i = allowed.indexOf(now as (typeof FLOATING_SIZE_STEPS)[number]);
  const j = Math.min(allowed.length - 1, Math.max(0, i + dir));
  return allowed[j] ?? now;
}

export const floatingSizeLabel = (scale: number) => `${Math.round(scale * 100)}%`;

export function readFloatingSize(): number {
  if (typeof window === "undefined") return FLOATING_SIZE_DEFAULT;
  try {
    const raw = window.localStorage.getItem(FLOATING_SIZE_STORAGE_KEY);
    return raw == null ? FLOATING_SIZE_DEFAULT : clampFloatingSize(raw);
  } catch { return FLOATING_SIZE_DEFAULT; }
}

export function writeFloatingSize(scale: number) {
  if (typeof window === "undefined") return;
  const v = clampFloatingSize(scale);
  try { window.localStorage.setItem(FLOATING_SIZE_STORAGE_KEY, String(v)); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
}

export function subscribeFloatingSize(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => { if (e.key === FLOATING_SIZE_STORAGE_KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", onStorage); };
}
