/** Per-browser identity for the school tracker. Signed-in users keep their own key. */

const IDENTITY_KEY = "mathgpl.quickIssue.identity";
const NAME_KEY = "mathgpl.quickIssue.displayName";

export function anonymousIdentity(storage: Storage): string {
  const existing = storage.getItem(IDENTITY_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const id = crypto.randomUUID();
  storage.setItem(IDENTITY_KEY, id);
  return id;
}

export function personKey(userId: string | null, storage: Storage): string {
  return userId ? `user:${userId}` : `anon:${anonymousIdentity(storage)}`;
}

export function lastWorkedKey(
  token: string,
  userId: string | null,
  storage: Storage,
): string {
  return `mathgpl.quickIssue.last.${token.toLowerCase()}.${personKey(userId, storage)}`;
}

export function readLastWorked(
  token: string,
  userId: string | null,
  storage: Storage,
): string | null {
  return storage.getItem(lastWorkedKey(token, userId, storage));
}

export function writeLastWorked(
  token: string,
  userId: string | null,
  storage: Storage,
  issueId: string,
): void {
  storage.setItem(lastWorkedKey(token, userId, storage), issueId);
}

export function readDisplayName(storage: Storage): string {
  return storage.getItem(NAME_KEY) ?? "";
}

export function writeDisplayName(storage: Storage, name: string): void {
  storage.setItem(NAME_KEY, name.trim());
}
