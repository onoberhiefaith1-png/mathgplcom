/**
 * Referral capture.
 *
 * A visitor arriving with `?ref=CODE` is remembered in this browser until they
 * create an account; the moment they are signed in, the code is turned into an
 * attribution once and then forgotten. Nothing about the visitor is stored
 * before they register.
 */
import { recordReferralOpen, claimReferral } from "./referrals.functions";

const KEY = "mathgpl.referral.code";

export const readStoredReferral = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const clearStoredReferral = () => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
};

/** Reads `?ref=` from the address, remembers it, and records the click. */
export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  const code = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase();
  if (!code) return;
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    /* storage unavailable — the click is still recorded */
  }
  void recordReferralOpen({ data: { code } }).catch(() => undefined);
}

/** Attributes a remembered code to the person who has just signed in. */
export async function claimStoredReferral() {
  const code = readStoredReferral();
  if (!code) return;
  try {
    await claimReferral({ data: { code } });
  } catch {
    return; // keep the code; a later attempt can still claim it
  }
  clearStoredReferral();
}
