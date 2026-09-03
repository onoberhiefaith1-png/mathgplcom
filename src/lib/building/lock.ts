/**
 * DOOR LOCK — the access-code contract, kept independent of any door.
 *
 * A lock is an OPTIONAL component mounted beside a door. It knows only three
 * things: which characters its code may use, how long the code is, and how to
 * hash a code so the secret itself never travels or gets stored in the clear.
 * Nothing here knows about hallways, rooms or navigation.
 */

export type LockCharset = "digits" | "letters" | "alphanumeric";

export const LOCK_CHARSET_LABEL: Record<LockCharset, string> = {
  digits: "Numbers only",
  letters: "Letters only",
  alphanumeric: "Numbers and letters",
};

export const MIN_CODE_LENGTH = 4;
export const MAX_CODE_LENGTH = 8;

/** The lock's public shape — everything a viewer may know about it. */
export interface DoorLock {
  id: string;
  building_id: string;
  door_id: string;
  charset: LockCharset;
  code_length: number;
}

const DIGITS = "0123456789";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const allowedCharacters = (charset: LockCharset): string =>
  charset === "digits" ? DIGITS : charset === "letters" ? LETTERS : DIGITS + LETTERS;

/** The code a teacher types, normalised the one way the lock understands. */
export const normaliseCode = (raw: string): string => raw.trim().toUpperCase();

export const isCharsetKey = (value: string): value is LockCharset =>
  value === "digits" || value === "letters" || value === "alphanumeric";

/**
 * Validate a teacher-chosen code against its own rules. Returns null when the
 * code is acceptable, or a plain-English reason when it is not.
 */
export const validateCode = (raw: string, charset: LockCharset, length: number): string | null => {
  const code = normaliseCode(raw);
  if (code.length !== length) return `The code must be exactly ${length} characters long.`;
  const allowed = allowedCharacters(charset);
  for (const ch of code) {
    if (!allowed.includes(ch)) {
      return charset === "digits"
        ? "This lock accepts numbers only."
        : charset === "letters"
          ? "This lock accepts letters only."
          : "This lock accepts numbers and letters only.";
    }
  }
  return null;
};

/**
 * The keypad layout for a charset. Digits keep the real security-panel layout
 * (1-9, then * 0 #); letter locks add the alphabet in rows of six.
 */
export const keypadRows = (charset: LockCharset): string[][] => {
  const numeric = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];
  if (charset === "digits") return numeric;
  const letters: string[][] = [];
  for (let i = 0; i < LETTERS.length; i += 6) letters.push(LETTERS.slice(i, i + 6).split(""));
  return charset === "letters" ? letters : [...numeric.slice(0, 3), ["*", "0", "#"], ...letters];
};

/**
 * Hash a code. SHA-256 over a per-door salt, available in both the browser and
 * the server runtime through Web Crypto, so the same code always hashes the
 * same way wherever it is checked.
 */
export const hashCode = async (code: string, doorId: string): Promise<string> => {
  const data = new TextEncoder().encode(`mathgpl-door-lock:${doorId}:${normaliseCode(code)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/** Index locks by the door they are mounted beside. */
export const indexLocksByDoor = (locks: DoorLock[]): Map<string, DoorLock> => {
  const map = new Map<string, DoorLock>();
  for (const lock of locks) if (lock.door_id) map.set(lock.door_id, lock);
  return map;
};
