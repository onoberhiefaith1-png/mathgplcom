/**
 * Rules shared by the MathGPL ID sign-in server functions. These live outside
 * the `.functions.ts` module so server-function splitting cannot strip them.
 */
import { z } from "zod";

export const ID_NOT_FOUND_MESSAGE = "We couldn't find a MathGPL ID matching that entry.";
export const EMAIL_NOT_FOUND_MESSAGE = "This account does not have a registered email address.";
export const PASSWORD_INCORRECT_MESSAGE = "The password you entered is incorrect.";

/** ADM/000001 · TCH/000001 · STU/000001 · PAR/000001 · SC/OX/000001 */
export const ID_PATTERN = /^(ADM|TCH|STU|PAR|SC)\/(?:[A-Z0-9]{2,6}\/)?\d{4,9}$/;

/**
 * People type letter O for zero and I/L for one. The number part of a MathGPL
 * ID is always digits, so those look-alikes are corrected before lookup.
 */
export const normaliseId = (value: string) => {
  const clean = value.toUpperCase().replace(/\s+/g, "");
  const parts = clean.split("/");
  const last = parts.pop();
  if (!last) return clean;
  return [...parts, last.replace(/O/g, "0").replace(/[IL]/g, "1")].join("/");
};

/**
 * The entry is kept exactly as typed: it may be a chosen ID (free text) or a
 * permanent issued ID, and only the issued form is look-alike corrected.
 */
export const credentialsSchema = z.object({
  mathgplId: z.string().trim().max(40),
  password: z.string().min(1).max(128),
});


export const emailSchema = z.object({ email: z.string().trim().email().max(255) });

/**
 * The account type is only ever one of the four public choices — an
 * administrator can never be self-assigned from a sign-up form.
 */
export const userIdSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["school", "teacher", "parent", "student"]).nullish(),
});


// Best-effort brake on guessing, per worker instance.
const attempts = new Map<string, { n: number; until: number }>();

export const throttle = (key: string) => {
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.until > now && entry.n >= 8) {
    throw new Error("Too many attempts. Please wait a minute and try again.");
  }
  if (!entry || entry.until <= now) attempts.set(key, { n: 1, until: now + 60_000 });
  else entry.n += 1;
};

/** First name for a greeting, from the account's profile. */
export const firstNameOf = (displayName: string | null, first: string | null) => {
  const candidate = (first ?? "").trim() || (displayName ?? "").trim();
  return candidate ? candidate.split(/\s+/)[0] : undefined;
};
