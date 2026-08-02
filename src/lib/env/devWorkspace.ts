/**
 * Development-only helper.
 *
 * The "Go to My Workspace" shortcut on the login page must never appear on the
 * published site. It is gated on the host the app is actually being served
 * from, not only on a build flag, so a production bundle served from the real
 * domain can never show it.
 */
const DEV_HOSTS = [
  "localhost",
  "127.0.0.1",
  ".lovableproject.com",
  "id-preview--",
  "-dev.lovable.app",
];

export function isDevWorkspaceHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return DEV_HOSTS.some((fragment) => host === fragment || host.includes(fragment));
}
