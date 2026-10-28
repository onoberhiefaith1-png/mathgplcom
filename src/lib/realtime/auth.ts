// Realtime socket authentication helper.
//
// Private channels (config.private = true) run an authorization check at JOIN
// time against the `realtime.messages` RLS policies, which call auth.uid() on
// the realtime socket. If the socket has not been handed the user's JWT, that
// check fails and the subscription silently dies — no postgres_changes events
// ever arrive. We must explicitly attach the access token to the realtime
// socket before subscribing to any private channel, and re-attach it whenever
// the auth state changes (sign-in / token refresh).

import { supabase } from "@/integrations/supabase/client";

let registered = false;

/**
 * Ensure the realtime socket carries the current user's access token so private
 * channels can pass their join-time authorization. Safe to call repeatedly.
 */
export async function ensureRealtimeAuth(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    await supabase.realtime.setAuth(token);
  } catch {
    // Best-effort; a failed setAuth just means the socket keeps its prior token.
  }
}

/**
 * Register a global listener that re-authenticates the realtime socket whenever
 * the auth session changes. Idempotent — only the first call wires it up.
 */
export function registerRealtimeAuthSync(): void {
  if (registered) return;
  registered = true;
  // Prime the socket immediately with whatever session exists.
  void ensureRealtimeAuth();
  supabase.auth.onAuthStateChange((_event, session) => {
    void supabase.realtime.setAuth(session?.access_token ?? null);
  });
}
