import { useAppearance } from "@/lib/theme/AppearanceProvider";
import type { AppearanceScope } from "@/lib/theme/appearance";
import { useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useLayoutEffect } from "react";

type Variant = "welcome" | "hub" | "workspace";

const VARIANT_CLASS: Record<Variant, string> = {
  welcome:
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/25 bg-transparent text-current transition hover:bg-current/10",
  hub:
    "hub-chrome inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/75 text-foreground shadow-[0_4px_22px_hsl(var(--background)/0.45)] backdrop-blur transition hover:border-primary",
  workspace:
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ws-border/70 bg-ws-panel/70 text-foreground transition hover:border-ws-gold/50 hover:text-foreground",
};

/**
 * One icon at a time: a sun while the surface is dark, a moon while it is light.
 * Welcome and the signed-in app are separate scopes.
 */
export function ThemeModeButton({
  scope,
  variant,
  host = scope === "app",
}: {
  scope: AppearanceScope;
  variant: Variant;
  /** When true, this button is the page's app toggle, so the floating fallback stays hidden. */
  host?: boolean;
}) {
  const { welcome, app, toggle, registerAppHost } = useAppearance();
  useLayoutEffect(() => {
    if (scope !== "app" || !host) return;
    return registerAppHost();
  }, [host, registerAppHost, scope]);

  const theme = scope === "welcome" ? welcome : app;
  const toLight = theme === "dark";
  const label = toLight ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={() => toggle(scope)}
      aria-label={label}
      title={label}
      className={VARIANT_CLASS[variant]}
    >
      {toLight ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

/** Pages without their own header still get the signed-in toggle. */
export function AppThemeFallback() {
  const { appHosts, signedIn, authReady } = useAppearance();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (!authReady || !signedIn || pathname === "/welcome" || appHosts > 0) return null;
  return (
    <div className="fixed right-14 top-3 z-[80]">
      <ThemeModeButton scope="app" variant="hub" host={false} />
    </div>
  );
}
