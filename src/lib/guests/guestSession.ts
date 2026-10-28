/**
 * Guest identity for people who open a Guest Link (a shared Course or
 * Assignment Card). They never register: a locally stored token keeps the same
 * guest across refreshes, and a name is asked for but always skippable.
 *
 * A guest is NEVER a student: their token only ever appears in `guest_attempts`.
 */
const TOKEN_KEY = "mathgpl.guestlink.token";
const NAME_KEY = "mathgpl.guestlink.name";
const SKIP_KEY = "mathgpl.guestlink.name.skipped";

const newToken = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "00000000-0000-4000-8000-000000000000";
};

/** Stable per-browser guest token (a uuid — the board identity). */
export function guestLinkToken(scope?: string): string {
  if (typeof window === "undefined") return "";
  const account=scope?window.localStorage.getItem("mathemagine.learningAccount"):null;
  const key = scope ? `${TOKEN_KEY}:${scope}${account?`:account:${account}`:""}` : TOKEN_KEY;
  let token = window.localStorage.getItem(key);
  if (!token) {
    token = newToken();
    window.localStorage.setItem(key, token);
  }
  return token;
}

export function guestLinkName(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(NAME_KEY);
  return stored && stored.trim() ? stored.trim() : null;
}

export function setGuestLinkName(name: string) {
  if (typeof window === "undefined") return;
  const clean = name.trim().slice(0, 40);
  if (clean) window.localStorage.setItem(NAME_KEY, clean);
}

/** The visitor chose to stay anonymous — never ask again. */
export function skipGuestLinkName() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SKIP_KEY, "1");
}

export function guestNameSkipped(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SKIP_KEY) === "1";
}

/** What the teacher sees in Guest Performance. */
export function guestLinkDisplayName(): string {
  const name = guestLinkName();
  if (name) return name;
  return `Guest ${guestLinkToken().slice(0, 4).toUpperCase()}`;
}

/** A private account-restored participation token, scoped to this one link. */
export function setGuestLinkToken(scope:string,token:string) {
 const account=window.localStorage.getItem("mathemagine.learningAccount");
 window.localStorage.setItem(`${TOKEN_KEY}:${scope}${account?`:account:${account}`:""}`,token);
}
