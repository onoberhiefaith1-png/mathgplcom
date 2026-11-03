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
import {
  COLOR_THEME_KEY,
  type ColorTheme,
  type ColorThemeScope,
  readColorTheme,
  writeColorTheme,
} from "./palette";

type AppearanceContextValue = {
  welcome: Appearance;
  app: Appearance;
  welcomeColor: ColorTheme;
  appColor: ColorTheme;
  toggle: (scope: AppearanceScope) => void;
  setColorTheme: (scope: ColorThemeScope, value: ColorTheme) => void;
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
  const [welcomeColor, setWelcomeColor] = useState<ColorTheme>("ocean-and-gold");
  const [appColor, setAppColor] = useState<ColorTheme>("ocean-and-gold");
  const [hydrated, setHydrated] = useState(false);
  const [appHosts, setAppHosts] = useState(0);

  useLayoutEffect(() => {
    const storage = browserStorage();
    setWelcome(readAppearance(storage, "welcome"));
    setApp(readAppearance(storage, "app"));
    setWelcomeColor(readColorTheme(storage, "welcome"));
    setAppColor(readColorTheme(storage, "app"));
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY.welcome) setWelcome(readAppearance(browserStorage(), "welcome"));
      if (event.key === APPEARANCE_KEY.app) setApp(readAppearance(browserStorage(), "app"));
      if (event.key === COLOR_THEME_KEY.welcome) setWelcomeColor(readColorTheme(browserStorage(), "welcome"));
      if (event.key === COLOR_THEME_KEY.app) setAppColor(readColorTheme(browserStorage(), "app"));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useLayoutEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    const signedIn = ready && Boolean(user);
    const onWelcome = pathname === "/welcome";
    if (signedIn && !onWelcome) {
      root.dataset.appTheme = app;
      root.dataset.colorTheme = appColor;
    } else {
      delete root.dataset.appTheme;
      delete root.dataset.colorTheme;
    }
  }, [app, appColor, hydrated, pathname, ready, user]);

  const toggle = useCallback((scope: AppearanceScope) => {
    const storage = browserStorage();
    const current = scope === "welcome" ? welcome : app;
    const next = nextAppearance(current);
    if (storage) writeAppearance(storage, scope, next);
    if (scope === "welcome") setWelcome(next);
    else setApp(next);
  }, [app, welcome]);

  const setColorTheme = useCallback((scope: ColorThemeScope, value: ColorTheme) => {
    const storage = browserStorage();
    if (storage) writeColorTheme(storage, scope, value);
    if (scope === "welcome") setWelcomeColor(value);
    else setAppColor(value);
  }, []);

  const registerAppHost = useCallback(() => {
    setAppHosts((count) => count + 1);
    return () => setAppHosts((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({
      welcome,
      app,
      welcomeColor,
      appColor,
      toggle,
      setColorTheme,
      appHosts,
      registerAppHost,
      signedIn: Boolean(user),
      authReady: ready,
    }),
    [app, appColor, appHosts, ready, registerAppHost, setColorTheme, toggle, user, welcome, welcomeColor],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
