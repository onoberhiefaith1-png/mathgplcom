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
import { resetInteractionState } from "@/lib/stability/interactionReset";


import "../styles.css";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FullscreenToggle } from "@/components/common/FullscreenToggle";
import { RouterErrorBoundary } from "@/components/common/RouterErrorBoundary";
import ImpersonationBanner from "@/components/accounts/ImpersonationBanner";
import GlobalSoundtrack from "@/components/audio/GlobalSoundtrack";
import ConnectionIndicator from "@/components/common/ConnectionIndicator";
import StabilityWatchdog from "@/components/common/StabilityWatchdog";

import { NavHistoryProvider } from "@/lib/nav/NavHistory";
import { AuthProvider } from "@/lib/auth/AuthProvider";

import { registerRealtimeAuthSync } from "@/lib/realtime/auth";
import { clearStaleChunkRecovery, recoverFromStaleChunk } from "@/lib/router/chunkRecovery";
import NotFound from "@/pages/NotFound";

// ported from App.tsx — keep the realtime socket authenticated so private
// channels stay authorized. Client-only: the realtime socket doesn't exist
// during SSR module evaluation.
if (typeof window !== "undefined") {
  registerRealtimeAuthSync();
}

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
        href: "https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Caveat:wght@500;600;700&family=Gloria+Hallelujah&family=Indie+Flower&family=Just+Another+Hand&family=Kalam:wght@300;400;700&family=Patrick+Hand&family=Shadows+Into+Light&display=swap",
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <ImpersonationBanner />
          <FullscreenToggle />
          <GlobalSoundtrack />
          <ConnectionIndicator />
          <StabilityWatchdog />


          <NavHistoryProvider>
            <Outlet />
          </NavHistoryProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>

  );
}
