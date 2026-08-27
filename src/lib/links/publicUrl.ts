/**
 * Public links.
 *
 * A link we hand to a student, a parent or the public must open on the public
 * site — never on a development or preview host, where a visitor would only see
 * "Access denied". Everything shareable is built through here.
 */

/** The public site — never a development/preview host. */
export const PUBLIC_SITE = "https://mathgpl.com";

/**
 * Hosts that are private by design.
 */
const isPrivateHost = (host: string) =>
  host === "localhost" ||
  host.endsWith(".localhost") ||
  host === "127.0.0.1" ||
  host.endsWith(".lovableproject.com") ||
  host.endsWith(".lovable.dev") ||
  host.endsWith(".sandbox.lovable.dev") ||
  host.includes("preview--") ||
  host.includes("id-preview");

export const publicOrigin = (): string => {
  if (typeof window === "undefined") return PUBLIC_SITE;
  const { origin, hostname } = window.location;
  return isPrivateHost(hostname) ? PUBLIC_SITE : origin;
};

/** The one shareable MathGPL Live entry link: the code is the credential. */
export const joinUrl = (code: string): string =>
  `${publicOrigin()}/live/join/${encodeURIComponent(String(code ?? "").trim().toUpperCase())}`;
