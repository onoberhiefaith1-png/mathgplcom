/**
 * Automatic sign-out after 15 minutes without activity.
 *
 * Activity is shared across tabs through localStorage, so working in one tab
 * keeps every tab alive, and a browser left closed past the limit is signed out
 * the moment it comes back. Public pages (shared challenge links, guest flows)
 * are skipped — there is no account there to sign out of.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSignOut } from "@/lib/auth/signOutEverywhere";

const IDLE_MS = 15 * 60 * 1000;
const WARN_MS = 60 * 1000;
const ACTIVITY_KEY = "mathgpl.lastActivity";
const CHECK_MS = 15_000;

const PUBLIC_PREFIXES = [/^\/c\//, /^\/g\//, /^\/guest(\/|$)/, /^\/join(\/|$)/, /^\/live\/join/];

const isPublicPath = (pathname: string) => PUBLIC_PREFIXES.some((re) => re.test(pathname));

const readLastActivity = (): number => {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : Date.now();
  } catch {
    return Date.now();
  }
};

const writeLastActivity = (at: number) => {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    /* private mode */
  }
};

export function useIdleSignOut() {
  const { user, ready } = useAuth();
  const signOut = useSignOut();
  const location = useLocation();
  const warnedRef = useRef(false);
  const firedRef = useRef(false);

  const active = ready && Boolean(user) && !isPublicPath(location.pathname);

  useEffect(() => {
    if (typeof window === "undefined" || !active) return;

    const mark = () => {
      warnedRef.current = false;
      writeLastActivity(Date.now());
    };
    mark();

    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
      "touchstart",
      "scroll",
    ];
    let throttled = false;
    const onActivity = () => {
      if (throttled) return;
      throttled = true;
      window.setTimeout(() => {
        throttled = false;
      }, 5_000);
      mark();
    };
    for (const event of events) window.addEventListener(event, onActivity, { passive: true });

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    function check() {
      if (firedRef.current) return;
      const idle = Date.now() - readLastActivity();
      if (idle >= IDLE_MS) {
        firedRef.current = true;
        void signOut({ reason: "idle" });
        toast.info("Signed out after 15 minutes of inactivity", {
          description: "Please sign in again to continue.",
        });
        return;
      }
      if (idle >= IDLE_MS - WARN_MS && !warnedRef.current) {
        warnedRef.current = true;
        toast("You will be signed out shortly", {
          description: "No activity for a while.",
          action: { label: "Stay signed in", onClick: mark },
        });
      }
    }

    const timer = window.setInterval(check, CHECK_MS);
    check();

    return () => {
      for (const event of events) window.removeEventListener(event, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [active, signOut]);
}
