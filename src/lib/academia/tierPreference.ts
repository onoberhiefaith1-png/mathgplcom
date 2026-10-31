/**
 * Default tier setting (next-edition spec §4 / §9). One personal preference:
 * Beginner, Intermediate or Expert. New Sessions open on it until the learner
 * switches with the session tier selector. Unset = Beginner.
 *
 * Stored on the device (instant, works offline in Mathemagine) and, on the
 * signed-in website, mirrored to the account (auth user metadata) so it
 * follows the learner across devices. Pure parsing lives here; the hook is
 * `useDefaultTier`.
 */
import { DEFAULT_TIER, isTier, normalizeTier, type AcademiaTier } from "./tiers";

export const DEFAULT_TIER_STORAGE_KEY = "mathgpl.academia.defaultTier";
/** Key on `auth.users.user_metadata` for the signed-in website account. */
export const DEFAULT_TIER_METADATA_KEY = "academia_default_tier";
const EVENT = "mathgpl:default-tier";

export const parseDefaultTier = (raw: unknown): AcademiaTier => normalizeTier(raw);

export function readDefaultTier(): AcademiaTier {
  if (typeof window === "undefined") return DEFAULT_TIER;
  try { return parseDefaultTier(window.localStorage.getItem(DEFAULT_TIER_STORAGE_KEY)); } catch { return DEFAULT_TIER; }
}

export function writeDefaultTier(tier: AcademiaTier) {
  if (typeof window === "undefined" || !isTier(tier)) return;
  try { window.localStorage.setItem(DEFAULT_TIER_STORAGE_KEY, tier); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: tier }));
}

export function subscribeDefaultTier(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => { if (e.key === DEFAULT_TIER_STORAGE_KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", onStorage); };
}
