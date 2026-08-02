import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";

import "../styles.css";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FullscreenToggle } from "@/components/common/FullscreenToggle";
import ImpersonationBanner from "@/components/accounts/ImpersonationBanner";

import { NavHistoryProvider } from "@/lib/nav/NavHistory";
import { AuthProvider } from "@/lib/auth/AuthProvider";

import { registerRealtimeAuthSync } from "@/lib/realtime/auth";
import { reportLovableError } from "@/lib/lovable-error-reporting";
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
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <ImpersonationBanner />
          <FullscreenToggle />

          <NavHistoryProvider>
            <Outlet />
          </NavHistoryProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>

  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a
            className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground"
            href="/"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
