/**
 * Public links.
 *
 * A link we hand to a student, a parent or the public must open on the public
 * site — never on a development or preview host, where a visitor would only see
 * "Access denied". Everything shareable is built through here.
 */

import { PUBLIC_SITE, publicOrigin } from "@/lib/public/publicSite";

export { PUBLIC_SITE, publicOrigin };

/** The one shareable MathGPL Live entry link: the code is the credential. */
export const joinUrl = (code: string): string =>
  `${publicOrigin()}/live/join/${encodeURIComponent(String(code ?? "").trim().toUpperCase())}`;

/**
 * A referral link. The person only ever sees the public MathGPL address; the
 * token travels behind it so MathGPL knows who referred them.
 */
export const referralUrl = (code: string): string =>
  `${publicOrigin()}/?ref=${encodeURIComponent(String(code ?? "").trim().toUpperCase())}`;
