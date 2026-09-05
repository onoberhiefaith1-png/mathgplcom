/**
 * Rules for a chosen sign-in ID.
 *
 * A chosen ID replaces the issued one for everyday use, so it must be free
 * text people can actually remember, while never colliding with the permanent
 * issued format (TCH/000012) or with anything that looks like a system name.
 */
import { z } from "zod";

export const CUSTOM_ID_MIN = 4;
export const CUSTOM_ID_MAX = 32;

/** Letters, digits, dot, dash, underscore. No slashes, so an issued ID can never be imitated. */
export const CUSTOM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,30}[A-Za-z0-9]$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "mathgpl",
  "mathgpl-admin",
  "support",
  "help",
  "root",
  "system",
  "owner",
  "moderator",
  "staff",
  "official",
  "security",
  "billing",
  "account",
  "accounts",
  "login",
  "signin",
  "signup",
  "teacher",
  "school",
  "student",
  "parent",
  "test",
  "null",
  "undefined",
]);

/** Prefixes of the permanent issued IDs — a chosen ID may never start with one. */
const ISSUED_PREFIX = /^(adm|sc|tch|stu|par)[\W_]/i;

export const customIdError = (value: string): string | null => {
  const id = value.trim();
  if (id.length < CUSTOM_ID_MIN) return `Use at least ${CUSTOM_ID_MIN} characters.`;
  if (id.length > CUSTOM_ID_MAX) return `Use at most ${CUSTOM_ID_MAX} characters.`;
  if (id.includes("/")) return "An ID cannot contain a slash.";
  if (!CUSTOM_ID_PATTERN.test(id))
    return "Use letters, numbers, dots, dashes or underscores, starting and ending with a letter or number.";
  if (ISSUED_PREFIX.test(id)) return "That looks like a system ID. Please choose something else.";
  if (RESERVED.has(id.toLowerCase())) return "That ID is reserved. Please choose another.";
  return null;
};

export const isValidCustomId = (value: string) => customIdError(value) === null;

/** Stored and compared without regard to letter case. */
export const normaliseCustomId = (value: string) => value.trim();

export const customIdSchema = z.object({
  customId: z
    .string()
    .trim()
    .min(CUSTOM_ID_MIN)
    .max(CUSTOM_ID_MAX)
    .refine(isValidCustomId, "That ID is not allowed."),
});
