import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  APPEARANCE_KEY,
  type Appearance,
  type AppearanceScope,
  nextAppearance,
  readAppearance,
  writeAppearance,
} from "./appearance";

type AppearanceContextValue = {
  welcome: Appearance;
  app: Appearance;
  toggle: (scope: AppearanceScope) => void;
  /** Signed-in chrome that already shows the app toggle. */
  appHosts: number;
  registerAppHost: () => () => void;
  signedIn: boolean;
  authReady: boolean;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Two independent themes. The app theme is applied on <html> only while a
 * signed-in person is outside the public welcome page, so the marketing shell
 * cannot flip the platform and the platform cannot flip the marketing shell.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [welcome, setWelcome] = useState<Appearance>("dark");
  const [app, setApp] = useState<Appearance>("dark");
  const [hydrated, setHydrated] = useState(false);
  const [appHosts, setAppHosts] = useState(0);

  useLayoutEffect(() => {
    const storage = browserStorage();
    setWelcome(readAppearance(storage, "welcome"));
    setApp(readAppearance(storage, "app"));
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY.welcome) setWelcome(readAppearance(browserStorage(), "welcome"));
      if (event.key === APPEARANCE_KEY.app) setApp(readAppearance(browserStorage(), "app"));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useLayoutEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    const signedIn = ready && Boolean(user);
    const onWelcome = pathname === "/welcome";
    if (signedIn && !onWelcome) root.dataset.appTheme = app;
    else delete root.dataset.appTheme;
  }, [app, hydrated, pathname, ready, user]);

  const toggle = useCallback((scope: AppearanceScope) => {
    const storage = browserStorage();
    const current = scope === "welcome" ? welcome : app;
    const next = nextAppearance(current);
    if (storage) writeAppearance(storage, scope, next);
    if (scope === "welcome") setWelcome(next);
    else setApp(next);
  }, [app, welcome]);

  const registerAppHost = useCallback(() => {
    setAppHosts((count) => count + 1);
    return () => setAppHosts((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({
      welcome,
      app,
      toggle,
      appHosts,
      registerAppHost,
      signedIn: Boolean(user),
      authReady: ready,
    }),
    [app, appHosts, ready, registerAppHost, toggle, user, welcome],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
