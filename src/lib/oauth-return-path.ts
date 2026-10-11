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
