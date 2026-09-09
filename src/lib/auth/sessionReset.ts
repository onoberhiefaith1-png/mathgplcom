/**
 * One place that ends an account's presence in this browser.
 *
 * Signing out used to clear only the Supabase session; everything the app was
 * already holding (role, workspace, profile, lists, background) stayed in the
 * query cache and in browser storage, so the *next* person to sign in on the
 * same device saw the previous account until a refresh replaced it. That is a
 * privacy fault, so the teardown lives here and every sign-out path uses it.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearWorkspaceScopeCache } from "@/lib/accounts/workspaceScope";
import { setViewAsScope } from "@/lib/accounts/viewAsScope";
import { resetAppContext } from "@/lib/stability/appContext";

/** Browser keys that describe *a person*, never the device. */
const ACCOUNT_LOCAL_KEYS = ["mathgpl.dashboard.background"];

/**
 * The note that says "you are visiting another account, here is the way back".
 * Entering a workspace deliberately changes identity, and wiping this note in
 * that moment removed the yellow bar and the way out. So it is cleared only on
 * a real departure (sign-out), never on an identity change.
 */
const WORKSPACE_NOTE_KEYS = ["mathgpl.impersonation.owner", "mathgpl.impersonation.active"];

const ACCOUNT_SESSION_KEYS = ["mathgpl:returnTo", "mathgpl:app-context"];

/**
 * Forget everything about the account that was signed in. Safe to call twice,
 * and safe to call before the new session exists.
 */
export async function resetAccountState(
  queryClient?: QueryClient,
  options?: { keepWorkspaceNote?: boolean },
): Promise<void> {
  if (queryClient) {
    // Cancel first: in-flight protected reads would otherwise land after the
    // session is gone and repopulate the cache (or storm 401s).
    try {
      await queryClient.cancelQueries();
    } catch {
      // A cancellation failure must never block the sign-out.
    }
    queryClient.clear();
  }

  clearWorkspaceScopeCache();
  setViewAsScope(null);
  resetAppContext();

  if (typeof window !== "undefined") {
    const localKeys = options?.keepWorkspaceNote
      ? ACCOUNT_LOCAL_KEYS
      : [...ACCOUNT_LOCAL_KEYS, ...WORKSPACE_NOTE_KEYS];
    for (const key of localKeys) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* storage blocked — nothing to clear */
      }
    }
    for (const key of ACCOUNT_SESSION_KEYS) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * The complete sign-out: forget the account, end the session, and land on the
 * login page with the protected pages off the back stack.
 */
export async function signOutCompletely(
  queryClient?: QueryClient,
  navigate?: (to: string, options?: { replace?: boolean }) => void,
): Promise<void> {
  await resetAccountState(queryClient);
  try {
    await supabase.auth.signOut();
  } catch {
    // Already signed out, or offline: the local state is cleared either way.
  }
  if (navigate) {
    navigate("/login", { replace: true });
    return;
  }
  if (typeof window !== "undefined") window.location.replace("/login");
}
