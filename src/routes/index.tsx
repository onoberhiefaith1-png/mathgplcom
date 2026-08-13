import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import Index from "@/pages/Index";
import WelcomePage from "@/pages/WelcomePage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ADSENSE_SCRIPT_SRC } from "@/lib/ads/adsense";
import { getSiteContent } from "@/lib/site/siteContent.functions";
import { EMPTY_SITE_CONTENT, type SiteContent } from "@/lib/site/types";

/**
 * The front door. Signed-out visitors see the cinematic public homepage; the
 * rotating building — and everything behind it — appears once signed in.
 */
const Landing = () => {
  const { user, ready } = useAuth();
  const content = Route.useLoaderData();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,hsl(220_60%_22%),hsl(224_65%_10%)_60%)] text-white/70">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return user ? <Index /> : <WelcomePage content={content} />;
};

export const Route = createFileRoute("/")({
  // A homepage must never go blank because one fetch failed: fall back to
  // empty content and let the page render its built-in opening screen.
  loader: async (): Promise<SiteContent> => {
    try {
      return await getSiteContent();
    } catch (error) {
      console.error(error);
      return EMPTY_SITE_CONTENT;
    }
  },
  head: () => ({
    meta: [
      { title: "MathGPL — Mathematics, Reimagined." },
      {
        name: "description",
        content:
          "Learn, explore and solve. MathGPL turns mathematics into an experience with lesson notes, Smartboard teaching, adventures and live progress.",
      },
      { property: "og:title", content: "MathGPL — Mathematics, Reimagined." },
      {
        property: "og:description",
        content:
          "Learn, explore and solve. MathGPL turns mathematics into an experience with lesson notes, Smartboard teaching, adventures and live progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    // Google AdSense loads on the homepage only — never from __root — so no
    // other page of the site serves Google advertisements.
    scripts: [
      { src: ADSENSE_SCRIPT_SRC, async: true, crossOrigin: "anonymous" },
    ],
  }),
  component: Landing,
});
