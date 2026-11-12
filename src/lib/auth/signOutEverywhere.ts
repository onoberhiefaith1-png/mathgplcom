/**
 * The one way to sign out.
 *
 * Ending the Supabase session is not enough: React Query keeps every answer it
 * has already fetched, so the next person to sign in on the same browser was
 * being handed the previous person's account, role and workspace. This routine
 * cancels in-flight requests, empties the cache, drops per-account browser
 * keys, ends the session, and replaces history so Back cannot restore the
 * previous account's screens.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { resetAccountState } from "@/lib/auth/sessionReset";
import { currentAppWindow } from "@/lib/install/appInstallPages";
import { MATHEMAGINE_START_URL } from "@/lib/install/mathemagineApp";

/** Browser keys that describe one account and must never outlive its session. */
const ACCOUNT_LOCAL_KEYS = [
  "mathgpl.dashboard.background",
  "mathgpl.impersonation.owner",
  "mathgpl.impersonation.active",
  // Kept-signed-in mark from an installed app: Log out ends it (see deviceSession.ts).
  "mathgpl.deviceSession",
];

export function clearAccountLocalState() {
  if (typeof window === "undefined") return;
  try {
    for (const key of ACCOUNT_LOCAL_KEYS) window.localStorage.removeItem(key);
    // Per-account variants written as "<key>:<userId>".
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (ACCOUNT_LOCAL_KEYS.some((base) => key.startsWith(`${base}:`))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* private mode — nothing to clear */
  }
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(
    async (options?: { to?: string; reason?: "idle" }) => {
      // Cancels in-flight reads, empties the cache, and forgets workspace,
      // view-as and app context as well as the per-account browser keys.
      await resetAccountState(queryClient);
      clearAccountLocalState();
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        /* the local session is already gone */
      }
      // The Mathemagine app goes back to its rotating building, with Login at the top right.
      const base = options?.to ?? (currentAppWindow() === "mathemagine" ? MATHEMAGINE_START_URL : "/login");
      const to = options?.reason === "idle" ? `${base}?signedOut=idle` : base;
      navigate(to, { replace: true });
    },
    [queryClient, navigate],
  );
}
