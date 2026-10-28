/**
 * Remembers the last page each account was on, so signing in again (after the
 * 15-minute-away sign-out or a manual Log out) returns to it. Keyed by user id:
 * a different account on the same device never inherits someone else's page.
 */
const PREFIX = "mathgpl.lastPage:";

const SKIP = [
  /^\/(login|signup|auth|reset-password|verified|accept-invite)(\/|$)/,
  /^\/c\//, /^\/g\//, /^\/guest(\/|$)/, /^\/join(\/|$)/, /^\/live\/join/,
];

export function isRememberablePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  const pathname = path.split(/[?#]/)[0];
  if (pathname === "/" || pathname === "/home") return false;
  return !SKIP.some((re) => re.test(pathname));
}

export function lastPageKey(userId: string) {
  return `${PREFIX}${userId}`;
}

export function rememberLastPage(userId: string, path: string, storage: Storage = window.localStorage) {
  if (!userId || !isRememberablePath(path)) return;
  try { storage.setItem(lastPageKey(userId), path); } catch { /* private mode */ }
}

export function readLastPage(userId: string | null | undefined, storage?: Storage): string | null {
  if (!userId) return null;
  try {
    const s = storage ?? window.localStorage;
    const v = s.getItem(lastPageKey(userId));
    return v && isRememberablePath(v) ? v : null;
  } catch {
    return null;
  }
}
