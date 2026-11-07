import { useAppearance } from "@/lib/theme/AppearanceProvider";
import type { AppearanceScope } from "@/lib/theme/appearance";
import { COLOR_THEMES, type ColorThemeScope } from "@/lib/theme/palette";
import { useRouterState } from "@tanstack/react-router";
import { useImmersiveSurfaceActive } from "@/lib/ui/immersiveSurface";
import { Moon, Palette, Sun } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Variant = "welcome" | "hub" | "workspace";

const VARIANT_CLASS: Record<Variant, string> = {
  welcome:
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/25 bg-transparent text-current transition hover:bg-current/10",
  hub:
    "hub-chrome inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/75 text-foreground shadow-[0_4px_22px_hsl(var(--background)/0.45)] backdrop-blur transition hover:border-primary",
  workspace:
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ws-border/70 bg-ws-panel/70 text-foreground transition hover:border-ws-gold/50 hover:text-foreground",
};

function ColorThemeButton({ scope, variant }: { scope: ColorThemeScope; variant: Variant }) {
  const { welcomeColor, appColor, setColorTheme } = useAppearance();
  const theme = scope === "welcome" ? welcomeColor : appColor;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = COLOR_THEMES.find((item) => item.id === theme) ?? COLOR_THEMES[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Colour theme"
        aria-expanded={open}
        aria-haspopup="menu"
        title={current.label}
        className={VARIANT_CLASS[variant]}
        style={{ boxShadow: "inset 0 -3px 0 0 hsl(var(--palette-accent))" }}
      >
        <Palette className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Colour theme" className="theme-palette-menu absolute right-0 top-[calc(100%+6px)] z-[90] w-56 rounded-xl p-1.5 shadow-lg">
          {COLOR_THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === item.id}
              onClick={() => {
                setColorTheme(scope, item.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${theme === item.id ? "font-bold" : ""}`}
            >
              <i aria-hidden="true" className="h-4 w-8 shrink-0 rounded-full" style={{ background: item.swatch }} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sun/moon plus the color theme, side by side.
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

  const immersive = useImmersiveSurfaceActive();
  const theme = scope === "welcome" ? welcome : app;
  const toLight = theme === "dark";
  // Inside the Smartboard and during active Game play these stay out of the way.
  if (immersive) return null;
  const label = toLight ? "Switch to light theme" : "Switch to dark theme";

  return (
    <span className="inline-flex items-center gap-1.5">
      <ColorThemeButton scope={scope} variant={variant} />
      <button
        type="button"
        onClick={() => toggle(scope)}
        aria-label={label}
        title={label}
        className={VARIANT_CLASS[variant]}
      >
        {toLight ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      </button>
    </span>
  );
}

/** Pages without their own header still get the signed-in toggle. */
export function AppThemeFallback() {
  const { appHosts, signedIn, authReady } = useAppearance();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const immersive = useImmersiveSurfaceActive();
  if (immersive) return null;
  if (!authReady || !signedIn || pathname === "/welcome" || appHosts > 0) return null;
  return (
    <div className="fixed right-4 top-3 z-[80]">
      <ThemeModeButton scope="app" variant="hub" host={false} />
    </div>
  );
}
