/**
 * The one public address MathGPL hands out.
 *
 * Smart Card links and MathGPL Live invite links are shared on social media and
 * in messages, so they must never carry a preview/sandbox host — and never the
 * old project address the app used before the domain moved.
 */
export const PUBLIC_SITE = "https://mathgpl.com";

/**
 * The origin every public share link is built from.
 *
 * Share links (Arena student/display links, guest links, Live invites, Smart
 * Cards) are always built on the canonical address, whatever address the
 * teacher happens to have the app open on. That covers private hosts
 * (localhost, Lovable preview/sandbox, *.lovable.app), which would show
 * "Access denied" to the public, and any alias or look-alike domain the app
 * may have been opened from.
 */
export const publicOrigin = (): string => PUBLIC_SITE;

/** Clean public link for a MathGPL Live session invite. */
export const liveInviteUrl = (code: string) => `${publicOrigin()}/live/join/${code}`;
