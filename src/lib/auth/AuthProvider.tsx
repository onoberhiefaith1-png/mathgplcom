/**
 * One session for the whole platform.
 *
 * Every feature page used to run its own `onAuthStateChange` + redirect block,
 * which bounced signed-in users back to /auth while the session was still
 * being restored from storage. Now a single provider owns the session and
 * pages read it from context, so one sign-in authenticates the entire app.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async/withTimeout";
import { clearAccountLocalState } from "@/lib/auth/signOutEverywhere";
import { resetAccountState } from "@/lib/auth/sessionReset";

/** Marks the current browsing session, so a fresh browser start is detectable. */
const TAB_KEY = "mathgpl:visit";



type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the stored session has been restored — never redirect before this flips. */
  ready: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  ready: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef<string | null>(null);
  const seenRef = useRef(false);
  /** True while the previous account's data is being wiped — nothing renders. */
  const [switching, setSwitching] = useState(false);

  // Whoever is signed in now owns the cache. If the identity changes — a new
  // sign-in, a switch, or a restored session belonging to somebody else — every
  // cached answer from the previous account is dropped before any screen reads
  // it. Without this the next person sees the previous person's account.
  const adopt = (next: Session | null) => {
    const nextId = next?.user?.id ?? null;
    if (seenRef.current && nextId !== lastUserIdRef.current) {
      setSwitching(true);
      void resetAccountState(queryClient).finally(() => setSwitching(false));
    }
    seenRef.current = true;
    lastUserIdRef.current = nextId;
    setSession(next);
  };

  useEffect(() => {
    let active = true;
    let restored = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      restored = true;
      adopt(next);
      setReady(true);
    });

    const restore = async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 8_000, "Session restoration timed out");
        if (!active) return;
        restored = true;
        adopt(data.session);
      } catch (firstError) {
        try {
          const { data } = await withTimeout(supabase.auth.getSession(), 5_000);
          if (!active) return;
          restored = true;
          adopt(data.session);
        } catch (retryError) {
          console.warn("[auth] session restoration failed", retryError ?? firstError);
          if (active && !restored) adopt(null);
        }
      } finally {
        if (active) setReady(true);
      }
    };
    void restore();
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // "Remember me" unticked means the sign-in belongs to this browsing session
  // only: closing the browser ends it, and coming back requires a fresh sign-in.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const remember = window.localStorage.getItem("mathgpl:remember");
      const sameVisit = window.sessionStorage.getItem(TAB_KEY) === "1";
      window.sessionStorage.setItem(TAB_KEY, "1");
      if (remember === "0" && !sameVisit) {
        void resetAccountState(queryClient).then(() => supabase.auth.signOut());
      }
    } catch {
      // Storage blocked — the session simply behaves as remembered.
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: switching ? null : session,
      user: switching ? null : session?.user ?? null,
      ready: ready && !switching,
      signOut: async () => {
        try {
          await queryClient.cancelQueries();
        } catch {
          /* best effort */
        }
        queryClient.clear();
        clearAccountLocalState();
        await supabase.auth.signOut();
      },
    }),
    [session, ready, switching, queryClient],

  );

  if (switching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Signing out…
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
