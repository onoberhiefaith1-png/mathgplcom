/**
 * Platform-owner workspace entry.
 *
 * The owner's own session is parked in localStorage, then a one-time token
 * minted server-side is exchanged for the target account's real session — so
 * the workspace behaves exactly as that user experiences it (same RLS, same
 * data). Exiting restores the parked owner session.
 */
import { supabase } from "@/integrations/supabase/client";
import { resetAccountState } from "@/lib/auth/sessionReset";

const OWNER_KEY = "mathgpl.impersonation.owner";
const ACTIVE_KEY = "mathgpl.impersonation.active";

export type ImpersonationInfo = { name: string; role: string; home: string };

export function activeImpersonation(): ImpersonationInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationInfo) : null;
  } catch {
    return null;
  }
}

export async function beginImpersonation(entry: {
  tokenHash: string;
  name: string;
  role: string;
  home: string;
}) {
  const { data } = await supabase.auth.getSession();
  const owner = data.session;
  if (owner) {
    window.localStorage.setItem(
      OWNER_KEY,
      JSON.stringify({ access_token: owner.access_token, refresh_token: owner.refresh_token }),
    );
  }

  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: entry.tokenHash,
  });
  if (error) {
    window.localStorage.removeItem(OWNER_KEY);
    throw new Error(error.message);
  }

  window.localStorage.setItem(
    ACTIVE_KEY,
    JSON.stringify({ name: entry.name, role: entry.role, home: entry.home }),
  );
}

/**
 * Entering a customer account the owner does not own: it requires that
 * customer's own email and password, exactly like any other sign-in.
 */
export async function beginImpersonationWithCredentials(entry: {
  email: string;
  password: string;
  name: string;
  role: string;
  home: string;
}) {
  const { data } = await supabase.auth.getSession();
  const owner = data.session;
  if (owner) {
    window.localStorage.setItem(
      OWNER_KEY,
      JSON.stringify({ access_token: owner.access_token, refresh_token: owner.refresh_token }),
    );
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: entry.email,
    password: entry.password,
  });
  if (error) {
    window.localStorage.removeItem(OWNER_KEY);
    throw new Error(error.message);
  }

  window.localStorage.setItem(
    ACTIVE_KEY,
    JSON.stringify({ name: entry.name, role: entry.role, home: entry.home }),
  );
}


export async function endImpersonation() {
  const raw = window.localStorage.getItem(OWNER_KEY);
  window.localStorage.removeItem(ACTIVE_KEY);
  window.localStorage.removeItem(OWNER_KEY);
  if (!raw) {
    // No parked owner session to return to: this is a full departure, so
    // nothing about the visited account may survive in this browser.
    await resetAccountState();
    await supabase.auth.signOut();
    return;
  }
  const parked = JSON.parse(raw) as { access_token: string; refresh_token: string };
  await supabase.auth.setSession(parked);
}
