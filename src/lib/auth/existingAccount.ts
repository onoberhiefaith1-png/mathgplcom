/**
 * Detects the "this email already has an account" outcome of a signup.
 *
 * For security, the authentication service never reveals that an address is
 * already registered: signing up again returns a success response and sends no
 * email at all. The one documented signal is that the returned user carries an
 * empty list of identities. Without this check the app shows a "check your
 * inbox" screen for an email that can never arrive.
 */
export type SignUpUserLike = {
  id?: string;
  identities?: unknown[] | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
} | null | undefined;

export function isExistingAccountSignup(user: SignUpUserLike): boolean {
  if (!user) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}
