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
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async/withTimeout";

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

  useEffect(() => {
    let active = true;
    let restored = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      restored = true;
      setSession(next);
      setReady(true);
    });
    const restore = async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 8_000, "Session restoration timed out");
        if (!active) return;
        restored = true;
        setSession(data.session);
      } catch (firstError) {
        try {
          const { data } = await withTimeout(supabase.auth.getSession(), 5_000);
          if (!active) return;
          restored = true;
          setSession(data.session);
        } catch (retryError) {
          console.warn("[auth] session restoration failed", retryError ?? firstError);
          if (active && !restored) setSession(null);
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
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      ready,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
