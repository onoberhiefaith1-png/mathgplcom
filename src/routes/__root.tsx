import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { setAppContext } from "@/lib/stability/appContext";
import { installDomGuard } from "@/lib/stability/domGuard";
import { resetInteractionState } from "@/lib/stability/interactionReset";


import "../styles.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { FullscreenToggle } from "@/components/common/FullscreenToggle";
import { RouterErrorBoundary } from "@/components/common/RouterErrorBoundary";
import ImpersonationBanner from "@/components/accounts/ImpersonationBanner";
import IdleSignOutWatcher from "@/components/auth/IdleSignOutWatcher";
import GlobalSoundtrack from "@/components/audio/GlobalSoundtrack";
import ConnectionIndicator from "@/components/common/ConnectionIndicator";
import StabilityWatchdog from "@/components/common/StabilityWatchdog";
import PageGuideProvider from "@/components/guides/PageGuideProvider";
import QuickActionBar from "@/components/workspace/QuickActionBar";


import { NavHistoryProvider } from "@/lib/nav/NavHistory";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

import { registerRealtimeAuthSync } from "@/lib/realtime/auth";
import { clearStaleChunkRecovery, recoverFromStaleChunk } from "@/lib/router/chunkRecovery";
import { captureReferralFromUrl, claimStoredReferral } from "@/lib/referrals/capture";
import { supabase } from "@/integrations/supabase/client";
import NotFound from "@/pages/NotFound";

const BOOTSTRAP_RECOVERY_SCRIPT = `(() => {
  const KEY = "mathgpl:bootstrap-recovery";
  const showFallback = () => {
    if (document.documentElement.dataset.mathgplMounted === "true") return;
    document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;font:15px/1.5 system-ui;background:#fafafa;color:#111"><section style="max-width:448px;text-align:center"><h1 style="font-size:20px;margin:0 0 8px">This page didn\\'t load</h1><p style="color:#4b5563;margin:0 0 24px">Please try again. Your work remains saved.</p><button onclick="location.reload()" style="border:0;border-radius:6px;background:#111;color:#fff;padding:9px 16px;font:inherit;cursor:pointer">Try again</button> <a href="/" style="display:inline-block;border:1px solid #d1d5db;border-radius:6px;color:#111;padding:8px 16px;text-decoration:none">Go home</a></section></main>';
  };
  const recover = () => {
    if (document.documentElement.dataset.mathgplMounted === "true") return;
    const previous = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - previous > 60000) {
      sessionStorage.setItem(KEY, String(Date.now()));
      const url = new URL(location.href);
      url.searchParams.set("__bootstrap_retry", String(Date.now()));
      location.replace(url.toString());
      return;
    }
    showFallback();
  };
  addEventListener("error", (event) => {
    const target = event.target;
    if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK")) recover();
  }, true);
  addEventListener("unhandledrejection", (event) => {
    const text = String(event.reason?.message || event.reason || "");
    if (/module|chunk|optimize dep|504/i.test(text)) recover();
  });
  setTimeout(recover, 12000);
})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "MathGPL Academy — Interactive Math Teaching Hub" },
      {
        name: "description",
        content:
          "MathGPL Academy: lesson notes, SmartBoard, and the Floating Number AI for teaching mathematics with rigour and clarity.",
      },
      { name: "author", content: "MathGPL Academy" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "MathGPL Academy — Interactive Math Teaching Hub" },
      {
        property: "og:description",
        content:
          "MathGPL Academy: lesson notes, SmartBoard, and the Floating Number AI for teaching mathematics with rigour and clarity.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/762893c7-5715-42ce-8bab-3f500dfdac42/id-preview-aefa51bd--46189bd9-877e-4d75-bf54-36d0153b4aa1.lovable.app-1777500387260.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "MathGPL Academy — Interactive Math Teaching Hub" },
      {
        name: "twitter:description",
        content:
          "MathGPL Academy: lesson notes, SmartBoard, and the Floating Number AI for teaching mathematics with rigour and clarity.",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/762893c7-5715-42ce-8bab-3f500dfdac42/id-preview-aefa51bd--46189bd9-877e-4d75-bf54-36d0153b4aa1.lovable.app-1777500387260.png",
      },
    ],
    links: [
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Caveat:wght@500;600;700&family=DM+Serif+Display&family=Gloria+Hallelujah&family=Indie+Flower&family=Just+Another+Hand&family=Kalam:wght@300;400;700&family=Patrick+Hand&family=Shadows+Into+Light&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RouterErrorBoundary,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP_RECOVERY_SCRIPT }} />
        <HeadContent />
      </head>
      {/* The AdSense script injects its own <ins> into the body, which would
          otherwise be reported as a hydration mismatch on every ad page. */}
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Editor node views let ProseMirror re-parent DOM React also owns; guard the
  // commit phase so a moved node can never blank the app.
  installDomGuard();
  // Keep the central context aware of where the teacher actually is, so any
  // recovery (or a manual refresh) returns to this screen, not a waiting board.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    setAppContext({ route: pathname });
    // Leaving a screen ends every interaction it started: cursor overrides,
    // pointer capture, drag/selection and tool state all go with it.
    resetInteractionState("route-change");
  }, [pathname]);

  useEffect(() => {
    document.documentElement.dataset.mathgplMounted = "true";
    window.sessionStorage.removeItem("mathgpl:bootstrap-recovery");
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has("__bootstrap_retry")) {
      currentUrl.searchParams.delete("__bootstrap_retry");
      window.history.replaceState(
        window.history.state,
        "",
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
    }
    // Keep realtime authorization out of module evaluation. If it fails, the
    // application is already mounted and can report/recover instead of going blank.
    try {
      registerRealtimeAuthSync();
    } catch (error) {
      console.error("[realtime] auth sync initialization failed", error);
    }
  }, []);

  // A visitor arriving with ?ref= is remembered here and attributed once they
  // hold an account. Nothing is stored about them before they register.
  useEffect(() => {
    captureReferralFromUrl();
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void claimStoredReferral();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void claimStoredReferral();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => recoverFromStaleChunk(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => recoverFromStaleChunk(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // Keep the loop guard while lazy route modules settle. Clearing it at
    // mount allowed the same missing chunk to trigger endless reloads.
    const recoveryCleanup = window.setTimeout(clearStaleChunkRecovery, 15_000);
    return () => {
      window.clearTimeout(recoveryCleanup);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <>
      {/* This executes while streamed HTML is parsed, before the client bundle.
          It prevents the bootstrap timer from mistaking healthy SSR for a failed mount. */}
      <script
        dangerouslySetInnerHTML={{
          __html: 'document.documentElement.dataset.mathgplMounted="true";',
        }}
      />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
            <TooltipProvider>
              <Toaster />
              <SonnerToaster />

              <ImpersonationBanner />
              <IdleSignOutWatcher />
              <FullscreenToggle />
              <GlobalSoundtrack />
              <ConnectionIndicator />
              <StabilityWatchdog />


              <NavHistoryProvider>
                <PageGuideProvider>
                  <Outlet />
                  <QuickActionBar />
                </PageGuideProvider>
              </NavHistoryProvider>

            </TooltipProvider>
          </LanguageProvider>
        </AuthProvider>
      </QueryClientProvider>
    </>

  );
}
