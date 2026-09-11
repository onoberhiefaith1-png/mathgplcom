/**
 * Automatic sign-out after 15 minutes AWAY from the app.
 *
 * The clock only runs while the app is not the visible page (other tab, other
 * app, minimised browser, screen off). Sitting on a visible MathGPL page never
 * counts, no matter how long. Public pages (shared challenge links, guest
 * flows) are skipped — there is no account there to sign out of.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSignOut } from "@/lib/auth/signOutEverywhere";

const AWAY_MS = 15 * 60 * 1000;
const HIDDEN_KEY = "mathgpl.hiddenSince";
const CHECK_MS = 15_000;

const PUBLIC_PREFIXES = [/^\/c\//, /^\/g\//, /^\/guest(\/|$)/, /^\/join(\/|$)/, /^\/live\/join/];

const isPublicPath = (pathname: string) => PUBLIC_PREFIXES.some((re) => re.test(pathname));

const readHiddenSince = (): number | null => {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

const writeHiddenSince = (at: number) => {
  try {
    window.localStorage.setItem(HIDDEN_KEY, String(at));
  } catch {
    /* private mode */
  }
};

const clearHiddenSince = () => {
  try {
    window.localStorage.removeItem(HIDDEN_KEY);
  } catch {
    /* private mode */
  }
};

export function useIdleSignOut() {
  const { user, ready } = useAuth();
  const signOut = useSignOut();
  const location = useLocation();
  const firedRef = useRef(false);

  const active = ready && Boolean(user) && !isPublicPath(location.pathname);

  useEffect(() => {
    if (typeof window === "undefined" || !active) return;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      clearHiddenSince();
      void signOut({ reason: "idle" });
      toast.info("Signed out after 15 minutes away", {
        description: "Please sign in again to continue.",
      });
    };

    /** Away long enough? Only meaningful while this page is hidden. */
    const check = () => {
      if (firedRef.current) return;
      const since = readHiddenSince();
      if (since === null) return;
      if (Date.now() - since >= AWAY_MS) fire();
    };

    const goHidden = () => {
      if (firedRef.current) return;
      if (readHiddenSince() === null) writeHiddenSince(Date.now());
    };

    const goVisible = () => {
      // Any visible tab stops the shared countdown, then re-check nothing stale.
      const since = readHiddenSince();
      clearHiddenSince();
      if (since !== null && Date.now() - since >= AWAY_MS) fire();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") goVisible();
      else goHidden();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", goHidden);

    // On mount: browser reopened or laptop resumed after being away too long.
    if (document.visibilityState === "visible") goVisible();
    else goHidden();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") check();
    }, CHECK_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", goHidden);
      window.clearInterval(timer);
    };
  }, [active, signOut]);
}
