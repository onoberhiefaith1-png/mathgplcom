/**
 * The one safe same-site return path after sign-in (e.g. back to the ChatGPT
 * approval screen). Returns "" for anything that could leave the site:
 * network paths, backslashes, control characters or other origins.
 */
export function oauthReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "";
  const origin = "https://app.invalid";
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin || target.pathname.startsWith("//")) return "";
    return target.pathname + target.search + target.hash;
  } catch {
    return "";
  }
}

/**
 * Consent return paths must reach the browser byte-for-byte. The in-app router
 * re-builds the address from a path + search object and the "/.lovable" dot
 * segment loses its query (authorization_id) on the way, so these are opened
 * with a full same-site page load instead.
 */
export function isOAuthConsentReturn(path: string): boolean {
  const safe = oauthReturnPath(path);
  return safe !== "" && safe.split(/[?#]/)[0] === "/.lovable/oauth/consent";
}

/** Go to a validated return path; consent returns keep their full query. */
export function goToReturnPath(path: string, navigate: (to: string, o?: { replace?: boolean }) => void): void {
  if (isOAuthConsentReturn(path) && typeof window !== "undefined") {
    window.location.replace(oauthReturnPath(path));
    return;
  }
  navigate(path, { replace: true });
}
