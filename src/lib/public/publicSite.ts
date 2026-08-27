/**
 * The one public address MathGPL hands out.
 *
 * Smart Card links and MathGPL Live invite links are shared on social media and
 * in messages, so they must never carry a preview/sandbox host — and never the
 * old project address the app used before the domain moved.
 */
export const PUBLIC_SITE = "https://mathgpl.com";

/**
 * Hosts that are private by design. A link copied from any of these would show
 * "Access denied" to a member of the public, so we never hand one out.
 */
const isPrivateHost = (host: string) =>
  host === "localhost" ||
  host.endsWith(".localhost") ||
  host === "127.0.0.1" ||
  host.endsWith(".lovableproject.com") ||
  host.endsWith(".lovable.dev") ||
  host.endsWith(".sandbox.lovable.dev") ||
  host.endsWith(".lovable.app") ||
  host.includes("preview--") ||
  host.includes("id-preview");

/** The origin every public link is built from. */
export const publicOrigin = (): string => {
  if (typeof window === "undefined") return PUBLIC_SITE;
  const { origin, hostname } = window.location;
  return isPrivateHost(hostname) ? PUBLIC_SITE : origin;
};

/** Clean public link for a MathGPL Live session invite. */
export const liveInviteUrl = (code: string) => `${publicOrigin()}/live/join/${code}`;
