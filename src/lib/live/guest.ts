/**
 * Audience identity for people who arrive through a MathGPL Live link or a
 * SmartBoard question link. They never register: a locally stored token keeps
 * the same guest across refreshes, and a display name is only collected when
 * the teacher switched "ask participants for a name" on.
 */
const TOKEN_KEY = "mathgpl.guest.token";
const NAME_KEY = "mathgpl.guest.name";

const randomToken = () =>
  `g_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export function guestToken(): string {
  if (typeof window === "undefined") return "";
  let token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = randomToken();
    window.localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

/** A short, stable label used when no name is requested — "Guest 4F2A". */
export function guestLabel(): string {
  const token = guestToken();
  return `Guest ${token.slice(-4).toUpperCase()}`;
}

export function guestName(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(NAME_KEY);
  return stored && stored.trim() ? stored.trim() : null;
}

export function setGuestName(name: string) {
  if (typeof window === "undefined") return;
  const clean = name.trim().slice(0, 40);
  if (clean) window.localStorage.setItem(NAME_KEY, clean);
}

/** The name to show the teacher: chosen name when present, else guest label. */
export function guestDisplayName(): string {
  return guestName() ?? guestLabel();
}
